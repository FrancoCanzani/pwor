import { LibraryGrid } from "@features/items/components/library-grid";
import { LibraryList } from "@features/items/components/library-list";
import { LibraryMasonry } from "@features/items/components/library-masonry";
import type { LibraryCollectionProps } from "@features/items/components/library-entry";
import type { LibraryViewMode } from "@features/items/lib/view";

export function LibraryView({
  view,
  ...props
}: LibraryCollectionProps & { view: LibraryViewMode }) {
  switch (view) {
    case "list":
      return <LibraryList {...props} />;
    case "grid":
      return <LibraryGrid {...props} />;
    case "masonry":
      return <LibraryMasonry {...props} />;
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}
