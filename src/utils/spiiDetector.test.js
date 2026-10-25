import { maskSPII } from './spiiDetector';

describe('maskSPII (case notes display)', () => {
  it('returns plain notes unchanged with no detections', () => {
    const notes = 'Customer asked about billing.\nFollow up Monday.';
    expect(maskSPII(notes)).toEqual({ text: notes, detections: [] });
  });

  it('handles empty and missing notes', () => {
    expect(maskSPII('')).toEqual({ text: '', detections: [] });
    expect(maskSPII(undefined)).toEqual({ text: '', detections: [] });
  });

  it('masks emails and phone numbers but keeps the surrounding text', () => {
    const { text, detections } = maskSPII('Reach jane.doe@example.com or 555-123-4567 later');
    expect(text).not.toContain('jane.doe@example.com');
    expect(text).not.toContain('555-123-4567');
    expect(text).toContain('jane****');
    expect(text.startsWith('Reach ')).toBe(true);
    expect(text.endsWith(' later')).toBe(true);
    expect(detections.map((d) => d.type)).toContain('PERSONAL INFORMATION');
  });

  it('masks every occurrence of a repeated value', () => {
    const { text } = maskSPII('SSN 123-45-6789, again 123-45-6789');
    expect(text).not.toContain('6789');
  });

  it('does not flag case reference ids', () => {
    expect(maskSPII('Case ID: 4111111111111111 escalated').detections).toEqual([]);
  });
});
