const SHARE_STORAGE_KEY = 'nihongo-shared-moji-url-v1';
const MOJI_ARTICLE_PATTERN = /https:\/\/(?:www\.|m\.)?mojidict\.com\/article\/[A-Za-z0-9_-]+(?:[?#][^\s]*)?/i;

const normalize = (value: string): string | null => {
  const match = value.match(MOJI_ARTICLE_PATTERN)?.[0];
  if (!match) return null;
  try {
    const url = new URL(match);
    const articleId = url.pathname.split('/').filter(Boolean)[1];
    return articleId ? `https://www.mojidict.com/article/${articleId}` : null;
  } catch {
    return null;
  }
};

export const extractSharedMojiUrl = (href: string): string | null => {
  try {
    const url = new URL(href, 'https://nihongo.invalid');
    for (const key of ['url', 'text', 'title']) {
      const value = url.searchParams.get(key);
      const result = value ? normalize(value) : null;
      if (result) return result;
    }
    return normalize(decodeURIComponent(url.search));
  } catch {
    return normalize(href);
  }
};

export const stripShareParameters = (href: string): string => {
  try {
    const url = new URL(href, 'https://nihongo.invalid');
    for (const key of ['share_target', 'url', 'text', 'title']) url.searchParams.delete(key);
    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
  } catch {
    return '/';
  }
};

export const captureSharedMojiUrl = (href: string, storage: Pick<Storage, 'setItem'> | null): string | null => {
  const sharedUrl = extractSharedMojiUrl(href);
  if (sharedUrl && storage) storage.setItem(SHARE_STORAGE_KEY, sharedUrl);
  return sharedUrl;
};

export const readCapturedSharedMojiUrl = (storage: Pick<Storage, 'getItem'> | null): string | null => {
  if (!storage) return null;
  return normalize(storage.getItem(SHARE_STORAGE_KEY) || '');
};

export const clearCapturedSharedMojiUrl = (storage: Pick<Storage, 'removeItem'> | null): void => {
  storage?.removeItem(SHARE_STORAGE_KEY);
};
