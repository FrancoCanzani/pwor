import { useQuery } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { tweetQueryOptions } from "@features/items/lib/tweet";
import type { TweetView } from "@shared/tweet";

const TOKEN_RE = /(https?:\/\/[^\s]+)|(@[A-Za-z0-9_]+)|(#\w+)/g;

function formatTweetDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!isValid(date)) return "";
  const pattern =
    date.getFullYear() === new Date().getFullYear()
      ? "MMM d"
      : "MMM d, yyyy";
  return format(date, pattern);
}

function TweetText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    const href = token.startsWith("@")
      ? `https://x.com/${token.slice(1)}`
      : token.startsWith("#")
        ? `https://x.com/hashtag/${encodeURIComponent(token.slice(1))}`
        : token;
    nodes.push(
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 hover:text-blue-700"
      >
        {token}
      </a>,
    );
    key += 1;
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{nodes}</p>
  );
}

function TweetMedia({ tweet }: { tweet: TweetView }) {
  const photos = tweet.photos;
  const videos = tweet.videos;
  if (photos.length === 0 && videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {photos.length > 0 ? (
        <div
          className={cn(
            "overflow-hidden rounded-md border border-border",
            photos.length > 1 && "grid grid-cols-2 gap-px bg-border",
          )}
        >
          {photos.map((photo) => (
            <img
              key={photo.url}
              src={photo.url}
              alt={photo.alt ?? ""}
              className={cn(
                "max-h-96 w-full object-cover",
                photos.length === 1 ? "object-contain" : "aspect-square",
              )}
            />
          ))}
        </div>
      ) : null}
      {videos.map((video, index) =>
        video.url ? (
          <video
            key={video.url}
            src={video.url}
            poster={video.poster ?? undefined}
            controls
            playsInline
            className="max-h-96 w-full rounded-md border border-border"
          />
        ) : video.poster ? (
          <img
            key={`${video.poster}-${index}`}
            src={video.poster}
            alt=""
            className="max-h-96 w-full rounded-md border border-border object-cover"
          />
        ) : null,
      )}
    </div>
  );
}

function TweetCard({
  tweet,
  nested = false,
}: {
  tweet: TweetView;
  nested?: boolean;
}) {
  const date = formatTweetDate(tweet.createdAt);

  return (
    <article className={cn("flex flex-col gap-2.5", nested && "gap-2")}>
      <header className="flex items-center gap-2">
        {tweet.author.avatarUrl ? (
          <img
            src={tweet.author.avatarUrl}
            alt=""
            className="size-8 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="size-8 shrink-0 rounded-sm bg-muted" />
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-bold">{tweet.author.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            @{tweet.author.handle}
            {date ? (
              <>
                <span className="px-1">·</span>
                <span className="font-nums">{date}</span>
              </>
            ) : null}
          </div>
        </div>
      </header>
      {tweet.text ? <TweetText text={tweet.text} /> : null}
      <TweetMedia tweet={tweet} />
      {tweet.quoted ? (
        <div className="rounded-md border border-border p-3">
          <TweetCard tweet={tweet.quoted} nested />
        </div>
      ) : null}
    </article>
  );
}

export function TweetEmbed({ id }: { id: string }) {
  const tweetQuery = useQuery(tweetQueryOptions(id));
  const tweet = tweetQuery.data;

  if (tweetQuery.isError) {
    return (
      <p className="text-xs text-muted-foreground">Couldn't load this tweet.</p>
    );
  }
  if (!tweet) return null;

  return (
    <div className="max-w-xl">
      <TweetCard tweet={tweet} />
    </div>
  );
}
