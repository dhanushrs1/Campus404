import { useMemo, useState } from "react";
import { ASSETS } from "../../../shared/assets.js";

const AVATAR_POOL = Object.values(ASSETS.avatars);

function fallbackAvatarForKey(key = "") {
  const source = String(key || "campus404");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return AVATAR_POOL[Math.abs(hash) % AVATAR_POOL.length] || ASSETS.avatars.curlyBlackBlueHoodie;
}

export default function AvatarImage({
  src = "",
  alt = "",
  fallbackKey = "",
  referrerPolicy,
  onError,
  ...props
}) {
  const cleanSrc = String(src || "").trim();
  const [failedSrc, setFailedSrc] = useState("");
  const fallbackSrc = useMemo(
    () => fallbackAvatarForKey(fallbackKey || alt || cleanSrc),
    [alt, cleanSrc, fallbackKey],
  );
  const shouldUseFallback = !cleanSrc || cleanSrc === failedSrc;
  const imageSrc = shouldUseFallback ? fallbackSrc : cleanSrc;

  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt}
      referrerPolicy={shouldUseFallback ? undefined : (referrerPolicy || "no-referrer")}
      onError={(event) => {
        if (!shouldUseFallback) {
          setFailedSrc(cleanSrc);
          return;
        }
        onError?.(event);
      }}
    />
  );
}

export { fallbackAvatarForKey };
