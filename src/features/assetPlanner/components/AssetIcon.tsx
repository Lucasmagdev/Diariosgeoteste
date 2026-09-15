import { useEffect, useState } from "react";
import type { BoardItem } from "../lib/board-types";

export function AssetIcon({
  item,
  className = "h-full w-full object-contain p-1",
  fallbackSize = 20,
}: {
  item: BoardItem;
  className?: string;
  fallbackSize?: number;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => setImageError(false), [item.imageUrl]);

  if (item.imageUrl && !imageError) {
    return (
      <img src={item.imageUrl} alt="" className={className} onError={() => setImageError(true)} />
    );
  }

  return (
    <span
      dangerouslySetInnerHTML={{
        __html: (item.iconSvg ?? "").replace(
          "<svg ",
          `<svg width="${fallbackSize}" height="${fallbackSize}" `,
        ),
      }}
    />
  );
}


