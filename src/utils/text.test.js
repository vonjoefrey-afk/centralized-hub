import { renderContentWithLinks } from './text';

describe('Text Utilities', () => {
  describe('renderContentWithLinks', () => {
    it('should return the identical string if no links exist', () => {
      const content = 'This is a simple text.';
      const result = renderContentWithLinks(content);
      expect(result).toEqual(['This is a simple text.']);
    });

    it('should return undefined if content is empty', () => {
      expect(renderContentWithLinks('')).toBe('');
      expect(renderContentWithLinks(undefined)).toBeUndefined();
    });

    it('should convert an http URL into an anchor tag component', () => {
      const content = 'Visit http://example.com for more info.';
      const result = renderContentWithLinks(content);
      
      expect(result.length).toBe(3); // "Visit ", anchor tag, " for more info."
      expect(result[0]).toBe('Visit ');
      expect(result[1].type).toBe('a');
      expect(result[1].props.href).toBe('http://example.com');
      expect(result[1].props.children).toBe('http://example.com');
    });

    it('should correctly handle multiple URLs', () => {
      const content = 'Check https://site.com and http://other.com.';
      const result = renderContentWithLinks(content);
      
      expect(result.length).toBe(5);
      expect(result[1].type).toBe('a');
      expect(result[3].type).toBe('a');
      expect(result[1].props.href).toBe('https://site.com');
      expect(result[3].props.href).toBe('http://other.com');
    });
  });
});
