import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsSafeText, isSafeText } from './safe-text';

class NoteDto {
  @IsSafeText()
  notes!: string;
}

describe('isSafeText', () => {
  it.each([
    'Patient reports nocturia 3x per night.',
    'PSA 4.2 ng/mL < previous 5.1 (improving)',
    'Line one\nLine two\tindented',
    'Ubwino bwa thanzi — Nyanja text with accents é',
  ])('accepts ordinary clinical text %p', (text) => {
    expect(isSafeText(text)).toBe(true);
  });

  it.each([
    '<script>alert(1)</script>',
    'hello <img src=x onerror=alert(1)>',
    '</textarea>',
    'click javascript:alert(1)',
    'null\u0000byte',
    'bell\u0007',
  ])('rejects markup or control characters %p', (text) => {
    expect(isSafeText(text)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSafeText(42)).toBe(false);
    expect(isSafeText(undefined)).toBe(false);
  });
});

describe('@IsSafeText', () => {
  it('reports a clear validation message', () => {
    const errors = validateSync(
      plainToInstance(NoteDto, { notes: '<b>bold</b>' }),
    );
    expect(errors[0].constraints).toEqual({
      isSafeText:
        'notes must be plain text without markup or control characters',
    });
    expect(validateSync(plainToInstance(NoteDto, { notes: 'fine' }))).toEqual(
      [],
    );
  });
});
