import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import TrackEditorPage from "./TrackEditorPage.jsx";
import TrackListPage from "./TrackListPage.jsx";

const TRACK_EDITOR_QUERY_KEYS = [
  "mode",
  "trackId",
  "nodeType",
  "sectionId",
  "exerciseId",
  "taskId",
  "levelTab",
];

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function TrackManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const trackPageParam = (searchParams.get("trackPage") || "list").toLowerCase();
  const trackPage = trackPageParam === "editor" ? "editor" : "list";
  const trackId = toPositiveInt(searchParams.get("trackId"));

  useEffect(() => {
    if (trackPage !== "editor" || trackId) {
      return;
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "tracks");
      next.set("trackPage", "list");
      TRACK_EDITOR_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey));
      return next;
    }, { replace: true });
  }, [setSearchParams, trackId, trackPage]);

  function handleEditTrack(nextTrackId) {
    const safeTrackId = toPositiveInt(nextTrackId);
    if (!safeTrackId) {
      return;
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "tracks");
      next.set("trackPage", "editor");
      next.set("trackId", String(safeTrackId));
      next.set("nodeType", "track");
      next.delete("sectionId");
      next.delete("exerciseId");
      next.delete("taskId");
      next.delete("levelTab");
      return next;
    });
  }

  function handleBackToList() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "tracks");
      next.set("trackPage", "list");
      TRACK_EDITOR_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey));
      return next;
    });
  }

  if (trackPage === "editor" && trackId) {
    return (
      <TrackEditorPage
        trackId={trackId}
        onBackToList={handleBackToList}
      />
    );
  }

  return <TrackListPage onEditTrack={handleEditTrack} />;
}
