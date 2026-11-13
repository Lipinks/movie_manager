import { useState, useCallback } from 'react';
import * as tagService from '../services/tagService';

const clean = (tags) => (Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string' && tag.trim()) : []);

/**
 * State for picking tags from the shared vocabulary, for a TagEditor.
 *
 * Creating a tag adds it to the vocabulary; if it differs from an existing
 * tag only in case, the existing spelling is used, so "drama" doesn't sit
 * beside "Drama".
 *
 * @param {string[]} initialTags
 * @returns {{tags: string[], vocabulary: string[], add, remove, create}}
 */
export const useTagSelection = (initialTags) => {
  const [tags, setTags] = useState(() => clean(initialTags));
  const [vocabulary, setVocabulary] = useState(() => tagService.getTags());

  const add = useCallback((tag) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);

  const remove = useCallback((tag) => {
    setTags((prev) => prev.filter((existing) => existing !== tag));
  }, []);

  const create = useCallback(
    (tag) => {
      const next = tagService.addTag(tag);
      setVocabulary(next);
      const typed = String(tag).trim().toLowerCase();
      add(next.find((existing) => existing.toLowerCase() === typed) || String(tag).trim());
    },
    [add]
  );

  return { tags, vocabulary, add, remove, create };
};
