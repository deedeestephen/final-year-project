"""Biomedical text embeddings for the chat's meaning search (proposal §3.3.5).

MedCPT (Jin et al., Bioinformatics 2023; NCBI, public domain) turns a question
and a knowledge-base passage into 768 numbers each; the larger their dot
product, the closer their meaning. It is PubMedBERT trained on 255 million
query-article pairs from PubMed searches, with one encoder for questions and
one for articles. Of the passages that share words with "Are African men more
likely to get it?", it puts the one on who is at higher risk first, where the
keyword score preferred the one about the gland.

The encoders run with numpy only, no PyTorch: the 12-layer BERT encoder below
follows Hugging Face's BertModel, and tests/test_meaning.py checks its output
against the transformers library. The weights (2 x 438 MB) are downloaded
once and checked against pinned SHA-256 sums:

    python -m app.chat.embeddings download
"""

import hashlib
import json
import math
import sys
import urllib.request
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: The ai-services folder; models live in ai-services/models (not in Git).
SERVICE_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = SERVICE_DIR / "models"

_TOKENIZER = "6e046044df8a2fcedb10607075dca187cae61d806c0d80a96c5b81017edc90c9"
_CONFIG = "3fea00b31d018d676d6b7e2f6cddcfe1abc69bcb88f5f09f51b848212e1671d1"
_LICENSE = "76b0009b86bfcb6dbbe5d51aa95a8103ddb2e9d582dca41c3d88e371175ce34e"


@dataclass(frozen=True)
class ModelSpec:
    folder: str
    repository: str
    #: A fixed revision, so the weights cannot change under us.
    revision: str
    #: Every file used, with its SHA-256.
    files: dict[str, str]
    #: Longest input, in tokens (as in the model card).
    max_tokens: int


QUERY_ENCODER = ModelSpec(
    folder="medcpt-query",
    repository="ncbi/MedCPT-Query-Encoder",
    revision="d83a36cc6b8e3a5c5e9d9d6ba156808c1643dcbc",
    files={
        "config.json": _CONFIG,
        "tokenizer.json": _TOKENIZER,
        "LICENSE": _LICENSE,
        "model.safetensors": "19d78c0d5eaee2f81e6c47c5425bbadcc0c6af016cbb5da4a000d64e59d6e342",
    },
    max_tokens=64,
)
ARTICLE_ENCODER = ModelSpec(
    folder="medcpt-article",
    repository="ncbi/MedCPT-Article-Encoder",
    revision="d05a736da4bb84ee4057b7f7999485be6ed85465",
    files={
        "config.json": _CONFIG,
        "tokenizer.json": _TOKENIZER,
        "LICENSE": _LICENSE,
        "model.safetensors": "a5d5ffe4d8666c1d0aa15f371b94fc3492ca8f927e5621abd4b3ee9fc845b0f3",
    },
    max_tokens=512,
)
MODELS = (QUERY_ENCODER, ARTICLE_ENCODER)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def is_installed(base: Path = MODELS_DIR) -> bool:
    """All files of both encoders present (their sums are checked when downloaded)."""
    return all((base / m.folder / name).is_file() for m in MODELS for name in m.files)


def download(base: Path = MODELS_DIR) -> None:
    """Fetches the pinned files; refuses any whose SHA-256 differs."""
    for model in MODELS:
        for name, expected in model.files.items():
            target = base / model.folder / name
            if target.is_file() and _sha256(target) == expected:
                print(f"  {model.folder}/{name}: already here")
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            url = f"https://huggingface.co/{model.repository}/resolve/{model.revision}/{name}"
            print(f"  {model.folder}/{name}: downloading")
            part = target.with_name(target.name + ".part")
            urllib.request.urlretrieve(url, part)  # noqa: S310 - fixed https URL
            actual = _sha256(part)
            if actual != expected:
                part.unlink()
                raise ValueError(f"{name}: checksum {actual} does not match the pinned one")
            part.replace(target)


# --- the encoder (numpy) -----------------------------------------------------------


def _erf(x: Any) -> Any:
    """Error function (Abramowitz and Stegun 7.1.26, error below 1.5e-7)."""
    import numpy as np

    sign = np.sign(x)
    x = np.abs(x)
    t = 1.0 / (1.0 + 0.3275911 * x)
    poly = (
        (((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592
    ) * t
    return sign * (1.0 - poly * np.exp(-x * x))


class BertEmbedder:
    """A BERT encoder that turns texts into vectors: the [CLS] token's output
    (MedCPT) or the mean of all tokens, optionally scaled to unit length."""

    def __init__(
        self,
        folder: Path,
        max_tokens: int,
        pooling: str = "cls",
        normalize: bool = False,
    ) -> None:
        import numpy as np
        from safetensors.numpy import load_file
        from tokenizers import Tokenizer

        self._np = np
        self.pooling = pooling
        self.normalize = normalize
        config = json.loads((folder / "config.json").read_text(encoding="utf-8"))
        self.layers = int(config["num_hidden_layers"])
        self.heads = int(config["num_attention_heads"])
        self.eps = float(config["layer_norm_eps"])
        self.tokenizer = Tokenizer.from_file(str(folder / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=max_tokens)
        self.tokenizer.enable_padding(pad_id=int(config["pad_token_id"]))
        weights = load_file(str(folder / "model.safetensors"))
        # Saved as BertModel ("embeddings....") or inside a wrapper ("bert.embeddings....").
        prefix = "bert." if "bert.embeddings.word_embeddings.weight" in weights else ""
        self.w = {
            k[len(prefix) :]: v.astype(np.float32, copy=False)
            for k, v in weights.items()
            if k.startswith(prefix)
        }

    def _norm(self, x: Any, name: str) -> Any:
        np = self._np
        mean = x.mean(-1, keepdims=True)
        var = ((x - mean) ** 2).mean(-1, keepdims=True)
        return (x - mean) / np.sqrt(var + self.eps) * self.w[f"{name}.weight"] + self.w[
            f"{name}.bias"
        ]

    def _linear(self, x: Any, name: str) -> Any:
        return x @ self.w[f"{name}.weight"].T + self.w[f"{name}.bias"]

    def _encode(self, ids: Any, mask: Any, types: Any) -> Any:
        np = self._np
        batch, length = ids.shape
        h = (
            self.w["embeddings.word_embeddings.weight"][ids]
            + self.w["embeddings.position_embeddings.weight"][:length]
            + self.w["embeddings.token_type_embeddings.weight"][types]
        )
        h = self._norm(h, "embeddings.LayerNorm")
        size = h.shape[-1] // self.heads
        # Padding gets no attention.
        blocked = ((1.0 - mask[:, None, None, :]) * np.finfo(np.float32).min).astype(np.float32)

        def heads(x: Any) -> Any:
            return x.reshape(batch, length, self.heads, size).transpose(0, 2, 1, 3)

        for i in range(self.layers):
            p = f"encoder.layer.{i}"
            q = heads(self._linear(h, f"{p}.attention.self.query"))
            k = heads(self._linear(h, f"{p}.attention.self.key"))
            v = heads(self._linear(h, f"{p}.attention.self.value"))
            scores = q @ k.transpose(0, 1, 3, 2) / math.sqrt(size) + blocked
            scores = np.exp(scores - scores.max(-1, keepdims=True))
            probs = scores / scores.sum(-1, keepdims=True)
            context = (probs @ v).transpose(0, 2, 1, 3).reshape(batch, length, -1)
            h = self._norm(
                self._linear(context, f"{p}.attention.output.dense") + h,
                f"{p}.attention.output.LayerNorm",
            )
            inner = self._linear(h, f"{p}.intermediate.dense")
            inner = 0.5 * inner * (1.0 + _erf(inner / math.sqrt(2.0)))
            h = self._norm(self._linear(inner, f"{p}.output.dense") + h, f"{p}.output.LayerNorm")
        return h

    def embed(
        self, texts: Sequence[str | tuple[str, str]], batch_size: int = 8
    ) -> list[list[float]]:
        """One vector per text; a (title, text) pair is encoded as two segments."""
        np = self._np
        vectors: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            encoded = self.tokenizer.encode_batch(list(texts[start : start + batch_size]))
            ids = np.array([e.ids for e in encoded], dtype=np.int64)
            types = np.array([e.type_ids for e in encoded], dtype=np.int64)
            mask = np.array([e.attention_mask for e in encoded], dtype=np.float32)
            hidden = self._encode(ids, mask, types)
            if self.pooling == "cls":
                pooled = hidden[:, 0, :]
            else:
                pooled = (hidden * mask[..., None]).sum(1) / np.maximum(
                    mask.sum(1, keepdims=True), 1e-9
                )
            if self.normalize:
                pooled = pooled / np.maximum(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12)
            vectors.extend(pooled.astype(float).tolist())
        return vectors


def one_thread_per_question() -> None:
    """Runs every matrix product on one processor thread, for the whole service.
    A question's products are too small to share well between threads; several
    questions encoded side by side (MeaningIndex's slots) answer about twice as
    many questions a second on a 4-core laptop (34 against 14, 1 October 2026)."""
    from threadpoolctl import threadpool_limits  # type: ignore[import-untyped]

    threadpool_limits(limits=1, user_api="blas")


def query_encoder(base: Path = MODELS_DIR) -> BertEmbedder:
    return BertEmbedder(base / QUERY_ENCODER.folder, QUERY_ENCODER.max_tokens)


def article_encoder(base: Path = MODELS_DIR) -> BertEmbedder:
    return BertEmbedder(base / ARTICLE_ENCODER.folder, ARTICLE_ENCODER.max_tokens)


def main(args: list[str]) -> int:
    base = Path(args[1]) if len(args) > 1 else MODELS_DIR
    if args[:1] == ["download"]:
        print(f"MedCPT query and article encoders (NCBI, public domain) into {base}")
        download(base)
        print("Done. Restart the AI service to use the meaning search.")
        return 0
    if args[:1] == ["check"]:
        ok = is_installed(base)
        print(f"{'installed' if ok else 'not installed'}: {base}")
        return 0 if ok else 1
    print("Usage: python -m app.chat.embeddings download | check [folder]")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
