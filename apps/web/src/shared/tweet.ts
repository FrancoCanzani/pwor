export {
  TWEET_HOSTS,
  TWEET_ID_RE,
  tweetIdFromInput,
  tweetIdFromUrl,
} from "@pwor/editor/embed";

export type TweetPhoto = {
  url: string;
  alt: string | null;
};

export type TweetVideo = {
  url: string | null;
  poster: string | null;
};

export type TweetView = {
  id: string;
  url: string;
  text: string;
  createdAt: string | null;
  author: {
    name: string;
    handle: string;
    avatarUrl: string | null;
  };
  photos: TweetPhoto[];
  videos: TweetVideo[];
  quoted: TweetView | null;
};

export function decodeTweetText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
