import React from 'react';

// Renders text content with http/https URLs turned into clickable links.
export const renderContentWithLinks = (content) => {
    if (!content) return content;

    // Capture URLs so split() keeps them as their own tokens.
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const isUrl = (s) => /^https?:\/\//.test(s); // non-global: no lastIndex state

    const parts = content.split(urlRegex);

    // Peel trailing sentence punctuation off a URL token so it isn't baked into
    // the href (e.g. "see http://x.com." should link to http://x.com, not …com.).
    for (let i = 0; i < parts.length; i += 1) {
        if (isUrl(parts[i])) {
            const trail = parts[i].match(/[.,!?;:)\]}'"]+$/);
            if (trail) {
                parts[i] = parts[i].slice(0, -trail[0].length);
                parts[i + 1] = trail[0] + (parts[i + 1] || '');
            }
        }
    }

    return parts.map((part, index) => {
        if (isUrl(part)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                >
                    {part}
                </a>
            );
        }
        return part;
    });
};
