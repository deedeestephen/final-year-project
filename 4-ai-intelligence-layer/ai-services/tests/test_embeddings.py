"""The numpy BERT encoder, the pinned download and the evaluation command, on a
tiny made-up model (the real MedCPT is checked in test_meaning.py when it is
downloaded)."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from safetensors.numpy import save_file
from tokenizers import Tokenizer, models, normalizers, pre_tokenizers, processors

from app.chat import embeddings, evaluate
from app.chat.embeddings import BertEmbedder, ModelSpec

VOCAB = ["[PAD]", "[UNK]", "[CLS]", "[SEP]", "psa", "test", "prostate", "finger", "is", "the",
         "pain", "##ful", "what", "does", "a", "measure", "?", "blood"]  # fmt: skip
HIDDEN, HEADS, LAYERS, INNER = 8, 2, 2, 16


def tiny_model(folder: Path, prefix: str = "") -> Path:
    """A 2-layer BERT with random weights, its config and a WordPiece tokenizer."""
    folder.mkdir(parents=True, exist_ok=True)
    vocab = {t: i for i, t in enumerate(VOCAB)}
    # "[UNK]" is the tokenizer's marker for unknown words, not a secret.
    tokenizer = Tokenizer(models.WordPiece(vocab, unk_token="[UNK]"))  # noqa: S106
    tokenizer.normalizer = normalizers.BertNormalizer(lowercase=True)
    tokenizer.pre_tokenizer = pre_tokenizers.BertPreTokenizer()
    tokenizer.post_processor = processors.TemplateProcessing(
        single="[CLS] $A [SEP]",
        pair="[CLS] $A [SEP] $B:1 [SEP]:1",
        special_tokens=[("[CLS]", 2), ("[SEP]", 3)],
    )
    tokenizer.save(str(folder / "tokenizer.json"))
    config = {
        "num_hidden_layers": LAYERS,
        "num_attention_heads": HEADS,
        "hidden_size": HIDDEN,
        "intermediate_size": INNER,
        "layer_norm_eps": 1e-12,
        "pad_token_id": 0,
    }
    (folder / "config.json").write_text(json.dumps(config), encoding="utf-8")
    rng = np.random.default_rng(7)

    def r(*shape: int) -> np.ndarray:
        return rng.normal(0, 0.5, shape).astype(np.float32)

    w = {
        "embeddings.word_embeddings.weight": r(len(VOCAB), HIDDEN),
        "embeddings.position_embeddings.weight": r(32, HIDDEN),
        "embeddings.token_type_embeddings.weight": r(2, HIDDEN),
        "embeddings.LayerNorm.weight": r(HIDDEN) + 1,
        "embeddings.LayerNorm.bias": r(HIDDEN),
    }
    for i in range(LAYERS):
        p = f"encoder.layer.{i}"
        for name, (out, inp) in {
            "attention.self.query": (HIDDEN, HIDDEN),
            "attention.self.key": (HIDDEN, HIDDEN),
            "attention.self.value": (HIDDEN, HIDDEN),
            "attention.output.dense": (HIDDEN, HIDDEN),
            "intermediate.dense": (INNER, HIDDEN),
            "output.dense": (HIDDEN, INNER),
        }.items():
            w[f"{p}.{name}.weight"] = r(out, inp)
            w[f"{p}.{name}.bias"] = r(out)
        for norm in ("attention.output.LayerNorm", "output.LayerNorm"):
            w[f"{p}.{norm}.weight"] = r(HIDDEN) + 1
            w[f"{p}.{norm}.bias"] = r(HIDDEN)
    save_file({prefix + k: v for k, v in w.items()}, str(folder / "model.safetensors"))
    return folder


@pytest.mark.parametrize("prefix", ["", "bert."])
def test_the_encoder_gives_one_vector_per_text(tmp_path: Path, prefix: str) -> None:
    encoder = BertEmbedder(tiny_model(tmp_path / "m", prefix), max_tokens=16)
    vectors = encoder.embed(["psa test", "what does a psa test measure?", "blood"])
    assert len(vectors) == 3
    assert all(len(v) == HIDDEN for v in vectors)
    assert vectors[0] != vectors[1]


@pytest.mark.parametrize("pooling", ["cls", "mean"])
def test_padding_does_not_change_a_text_s_vector(tmp_path: Path, pooling: str) -> None:
    # Alone, "psa test" has no padding; next to a longer text it is padded. The
    # attention mask and the pooling must make the two vectors the same.
    encoder = BertEmbedder(tiny_model(tmp_path / "m"), max_tokens=16, pooling=pooling)
    (alone,) = encoder.embed(["psa test"])
    batched = encoder.embed(["psa test", "what does a psa test measure? is the finger painful?"])
    assert batched[0] == pytest.approx(alone, abs=1e-5)


def test_mean_pooling_can_be_scaled_to_unit_length(tmp_path: Path) -> None:
    encoder = BertEmbedder(
        tiny_model(tmp_path / "m"), max_tokens=16, pooling="mean", normalize=True
    )
    for vector in encoder.embed(["psa test", "the prostate"]):
        assert float(np.linalg.norm(vector)) == pytest.approx(1.0, abs=1e-6)


def test_a_title_and_text_pair_is_read_as_two_segments(tmp_path: Path) -> None:
    encoder = BertEmbedder(tiny_model(tmp_path / "m"), max_tokens=16)
    (pair,) = encoder.embed([("psa test", "prostate")])
    (joined,) = encoder.embed(["psa test prostate"])
    assert pair != pytest.approx(joined, abs=1e-3)


def test_long_texts_are_cut_to_the_token_limit(tmp_path: Path) -> None:
    encoder = BertEmbedder(tiny_model(tmp_path / "m"), max_tokens=6)
    long_text = " ".join(["psa test"] * 50)
    (vector,) = encoder.embed([long_text])
    assert len(vector) == HIDDEN


# --- the pinned download ------------------------------------------------------------


def fake_spec(content: bytes) -> ModelSpec:
    return ModelSpec(
        folder="tiny",
        repository="example/tiny",
        revision="0" * 40,
        files={"model.safetensors": hashlib.sha256(content).hexdigest()},
        max_tokens=8,
    )


def test_the_download_keeps_only_files_with_the_pinned_checksum(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fetched: list[str] = []

    def fetch(url: str, target: Path) -> None:
        fetched.append(url)
        Path(target).write_bytes(b"the real weights")

    monkeypatch.setattr(embeddings.urllib.request, "urlretrieve", fetch)
    monkeypatch.setattr(embeddings, "MODELS", (fake_spec(b"the real weights"),))
    assert not embeddings.is_installed(tmp_path)
    embeddings.download(tmp_path)
    assert fetched == [f"https://huggingface.co/example/tiny/resolve/{'0' * 40}/model.safetensors"]
    assert embeddings.is_installed(tmp_path)
    embeddings.download(tmp_path)  # already there: not fetched again
    assert len(fetched) == 1

    monkeypatch.setattr(embeddings, "MODELS", (fake_spec(b"something else"),))
    other = tmp_path / "other"
    with pytest.raises(ValueError, match="does not match the pinned one"):
        embeddings.download(other)
    assert not list(other.rglob("*.part"))
    assert not embeddings.is_installed(other)


def test_the_command_line(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    assert embeddings.main(["check", str(tmp_path)]) == 1
    downloaded: list[Path] = []
    monkeypatch.setattr(embeddings, "download", lambda base: downloaded.append(base))
    assert embeddings.main(["download", str(tmp_path)]) == 0
    assert downloaded == [tmp_path]
    assert embeddings.main([]) == 2


def test_questions_use_one_thread_of_the_matrix_library() -> None:
    from threadpoolctl import threadpool_info, threadpool_limits

    # Leaving the block puts the library's own thread count back for later tests.
    with threadpool_limits(limits=None):
        embeddings.one_thread_per_question()
        blas = [i for i in threadpool_info() if i["user_api"] == "blas"]
        assert blas
        assert all(i["num_threads"] == 1 for i in blas)


def test_the_real_pins_name_both_medcpt_encoders() -> None:
    assert [m.repository for m in embeddings.MODELS] == [
        "ncbi/MedCPT-Query-Encoder",
        "ncbi/MedCPT-Article-Encoder",
    ]
    for model in embeddings.MODELS:
        assert len(model.revision) == 40
        assert all(len(sha) == 64 for sha in model.files.values())


# --- the evaluation command ---------------------------------------------------------


class SameForAll:
    def scores(self, question: str, passages: list[object]) -> list[float]:
        return [60.0] * len(passages)


def test_the_evaluation_runs_and_says_when_the_models_are_missing(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(evaluate.embeddings, "is_installed", lambda: False)
    assert evaluate.main() == 1
    assert "not downloaded" in capsys.readouterr().out

    class Index:
        @staticmethod
        def build(_: object) -> SameForAll:
            return SameForAll()

    monkeypatch.setattr(evaluate.embeddings, "is_installed", lambda: True)
    monkeypatch.setattr(evaluate, "MeaningIndex", Index)
    assert evaluate.main() == 0
    out = capsys.readouterr().out
    assert "keywords + meaning" in out
    assert "follow-ups right" in out
