"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type ContentType =
  | "COURSE"
  | "MICRO_LEARNING"
  | "PODCAST"
  | "DOCUMENT"
  | "IMPLEMENTATION_GUIDE"
  | "QUIZ_ASSESSMENT"
  | "GAME"
  | "VIDEO";

type VideoEntry = { url: string; description: string };
type GuideItem = { format: string; url: string; description: string };

interface ContentAddFormProps {
  contentType: ContentType;
  onSuccess: () => void;
  onCancel: () => void;
  domainId: string;
  onDomainChange: (id: string) => void;
  domainOptions: { id: string; name: string }[];
  tenantIds: string[];
  userIds: string[];
  assignToAllCompanies: boolean;
  onTenantChange: (ids: string[]) => void;
  onUserChange: (ids: string[]) => void;
  onAssignToAllChange: (v: boolean) => void;
  tenants: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  onCourseCreated?: (courseId: string, courseTitle: string) => void;
  /** When true, hides company assignment UI — content is always public (trainer flow) */
  publicOnly?: boolean;
}

export function ContentAddForm({
  contentType,
  onSuccess,
  onCancel,
  domainId,
  domainOptions,
  tenantIds,
  userIds,
  assignToAllCompanies,
  onTenantChange,
  onUserChange,
  onAssignToAllChange,
  tenants,
  users,
  onDomainChange,
  onCourseCreated,
  publicOnly = false,
}: ContentAddFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Type-specific state
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [gameUrl, setGameUrl] = useState("");
  const [scormUrl, setScormUrl] = useState("");
  const [xapiEndpoint, setXapiEndpoint] = useState("");
  const [microVideos, setMicroVideos] = useState<VideoEntry[]>([{ url: "", description: "" }]);
  const [podcastMediaType, setPodcastMediaType] = useState<"audio" | "video">("audio");
  const [podcastThumbnailUrl, setPodcastThumbnailUrl] = useState("");
  const [guideItems, setGuideItems] = useState<GuideItem[]>([
    { format: "video", url: "", description: "" },
  ]);
  const [guideFormat, setGuideFormat] = useState("video");

  const addMicroVideo = () =>
    setMicroVideos((p) => [...p, { url: "", description: "" }]);
  const removeMicroVideo = (i: number) =>
    setMicroVideos((p) => p.filter((_, idx) => idx !== i));
  const updateMicroVideo = (i: number, f: keyof VideoEntry, v: string) =>
    setMicroVideos((p) => p.map((e, idx) => (idx === i ? { ...e, [f]: v } : e)));

  const addGuideItem = () =>
    setGuideItems((p) => [...p, { format: guideFormat, url: "", description: "" }]);
  const removeGuideItem = (i: number) =>
    setGuideItems((p) => p.filter((_, idx) => idx !== i));
  const updateGuideItem = (i: number, f: keyof GuideItem, v: string) =>
    setGuideItems((p) => p.map((e, idx) => (idx === i ? { ...e, [f]: v } : e)));

  const buildPayload = (): Record<string, unknown> | null => {
    const base: Record<string, unknown> = {
      type: contentType,
      title: title.trim(),
      description: description.trim() || undefined,
      domainId: domainId || undefined,
      durationMinutes: duration ? parseInt(duration, 10) : undefined,
      tenantIds: assignToAllCompanies ? [] : tenantIds,
      userIds,
    };

    switch (contentType) {
      case "COURSE":
        return {
          ...base,
          metadata: {
            scormPackageUrl: scormUrl || undefined,
            xapiEndpoint: xapiEndpoint || undefined,
          },
        };
      case "MICRO_LEARNING": {
        const valid = microVideos.filter((v) => v.url.trim());
        if (valid.length === 0) return null;
        const first = valid[0];
        return {
          ...base,
          mediaId: first.url,
          description: first.description || description || undefined,
          metadata: { videoUrl: first.url, hlsUrl: first.url, description: first.description },
        };
      }
      case "PODCAST":
        return {
          ...base,
          mediaId: podcastMediaType === "audio" ? audioUrl : videoUrl,
          metadata: {
            audioUrl: podcastMediaType === "audio" ? audioUrl : undefined,
            videoUrl: podcastMediaType === "video" ? videoUrl : undefined,
            thumbnailUrl: podcastMediaType === "audio" && podcastThumbnailUrl ? podcastThumbnailUrl : undefined,
          },
        };
      case "DOCUMENT":
        return {
          ...base,
          mediaId: documentUrl,
          metadata: { documentUrl },
        };
      case "IMPLEMENTATION_GUIDE":
        return {
          ...base,
          metadata: {
            items: guideItems.filter((i) => i.url.trim() || i.description.trim()),
          },
        };
      case "GAME":
        return {
          ...base,
          mediaId: gameUrl,
          metadata: { gameUrl },
        };
      case "VIDEO":
        return {
          ...base,
          mediaId: videoUrl,
          metadata: { hlsUrl: videoUrl, videoUrl },
        };
      case "QUIZ_ASSESSMENT":
        return {
          ...base,
          mediaId: documentUrl || undefined,
          metadata: documentUrl ? { quizUrl: documentUrl } : {},
        };
      default:
        return base;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (contentType === "COURSE") {
        const res = await fetch(`${API}/content/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            domainId: domainId || undefined,
            durationMinutes: duration ? parseInt(duration, 10) : undefined,
            tenantIds: assignToAllCompanies ? [] : tenantIds,
            userIds,
            scormMetadata: {
              scormPackageUrl: scormUrl || undefined,
              xapiEndpoint: xapiEndpoint || undefined,
            },
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        onSuccess();
        onCourseCreated?.(created.id, title.trim());
        return;
      }

      const payload = buildPayload();
      if (!payload) throw new Error("Invalid payload");

      // MICRO_LEARNING: create one ContentItem per video
      if (contentType === "MICRO_LEARNING") {
        const valid = microVideos.filter((v) => v.url.trim());
        for (const v of valid) {
          const p = {
            type: "MICRO_LEARNING",
            title: valid.length > 1 ? `${title.trim()} (${valid.indexOf(v) + 1})` : title.trim(),
            description: v.description || description || undefined,
            domainId: domainId || undefined,
            durationMinutes: duration ? parseInt(duration, 10) : undefined,
            tenantIds: assignToAllCompanies ? [] : tenantIds,
            userIds,
            mediaId: v.url,
            metadata: { videoUrl: v.url, hlsUrl: v.url, description: v.description },
          };
          const res = await fetch(`${API}/content`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
          if (!res.ok) throw new Error(await res.text());
        }
        onSuccess();
        return;
      }

      const res = await fetch(`${API}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    title.trim() &&
    (contentType !== "PODCAST" ||
      (podcastMediaType === "audio" ? audioUrl.trim() : videoUrl.trim())) &&
    (contentType !== "DOCUMENT" || documentUrl.trim()) &&
    (contentType !== "GAME" || gameUrl.trim()) &&
    (contentType !== "VIDEO" || videoUrl.trim()) &&
    (contentType !== "MICRO_LEARNING" || microVideos.some((v) => v.url.trim())) &&
    (contentType !== "IMPLEMENTATION_GUIDE" ||
      guideItems.some((i) => i.url.trim() || i.description.trim()));

  return (
    <Card className="p-6 space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Content title"
      />
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what learners will gain..."
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
        />
      </div>
      <Input
        label="Duration (minutes)"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        placeholder="e.g. 15"
      />

      {/* COURSE: Curriculum hint + SCORM */}
      {contentType === "COURSE" && (
        <div className="space-y-3">
          <p className="text-sm text-brand-grey">
            Create the course first, then add curriculum (sections & items) in the next step.
          </p>
          <Input
            label="SCORM Package URL (optional)"
            value={scormUrl}
            onChange={(e) => setScormUrl(e.target.value)}
            placeholder="https://...zip"
          />
          <Input
            label="xAPI Endpoint (optional)"
            value={xapiEndpoint}
            onChange={(e) => setXapiEndpoint(e.target.value)}
            placeholder="https://..."
          />
        </div>
      )}

      {/* MICRO_LEARNING: Videos with link & description */}
      {contentType === "MICRO_LEARNING" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Add Videos</label>
            <Button variant="ghost" size="sm" onClick={addMicroVideo}>
              + Add another video
            </Button>
          </div>
          {microVideos.map((v, i) => (
            <div key={i} className="p-3 rounded-lg border border-brand-grey-light space-y-2">
              <Input
                label="Video URL"
                value={v.url}
                onChange={(e) => updateMicroVideo(i, "url", e.target.value)}
                placeholder="https://...m3u8 or direct video URL"
              />
              <Input
                label="Description"
                value={v.description}
                onChange={(e) => updateMicroVideo(i, "description", e.target.value)}
                placeholder="Brief description of this video"
              />
              {microVideos.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => removeMicroVideo(i)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PODCAST: Audio OR Video + description */}
      {contentType === "PODCAST" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Media type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="podcastMedia"
                  checked={podcastMediaType === "audio"}
                  onChange={() => setPodcastMediaType("audio")}
                />
                Add Audio
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="podcastMedia"
                  checked={podcastMediaType === "video"}
                  onChange={() => setPodcastMediaType("video")}
                />
                Add Video
              </label>
            </div>
          </div>
          {podcastMediaType === "audio" ? (
            <>
              <Input
                label="Audio URL"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://...mp3 or audio URL"
              />
              <Input
                label="Thumbnail / Cover image (recommended)"
                value={podcastThumbnailUrl}
                onChange={(e) => setPodcastThumbnailUrl(e.target.value)}
                placeholder="https://...jpg or image URL — shown while audio plays"
              />
            </>
          ) : (
            <Input
              label="Video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://...mp4 or video URL"
            />
          )}
        </div>
      )}

      {/* IMPLEMENTATION_GUIDE: video, audio, document, quiz, checklist */}
      {contentType === "IMPLEMENTATION_GUIDE" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Add resources</label>
            <div className="flex gap-2">
              <select
                value={guideFormat}
                onChange={(e) => setGuideFormat(e.target.value)}
                className="px-3 py-1.5 rounded border text-sm"
              >
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="document">Document</option>
                <option value="quiz">Quiz</option>
                <option value="checklist">Checklist</option>
              </select>
              <Button variant="ghost" size="sm" onClick={addGuideItem}>
                + Add
              </Button>
            </div>
          </div>
          {guideItems.map((item, i) => (
            <div key={i} className="p-3 rounded-lg border border-brand-grey-light space-y-2">
              <div className="flex gap-2">
                <select
                  value={item.format}
                  onChange={(e) => updateGuideItem(i, "format", e.target.value)}
                  className="px-3 py-2 rounded border text-sm flex-1"
                >
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                  <option value="quiz">Quiz</option>
                  <option value="checklist">Checklist</option>
                </select>
                {guideItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => removeGuideItem(i)}
                  >
                    ×
                  </Button>
                )}
              </div>
              <Input
                label="URL or content"
                value={item.url}
                onChange={(e) => updateGuideItem(i, "url", e.target.value)}
                placeholder="https://... or content URL"
              />
              <Input
                label="Description"
                value={item.description}
                onChange={(e) => updateGuideItem(i, "description", e.target.value)}
                placeholder="Description of this resource"
              />
            </div>
          ))}
        </div>
      )}

      {/* DOCUMENT: PDF or doc/docx */}
      {contentType === "DOCUMENT" && (
        <Input
          label="Document URL (PDF, DOC, or DOCX)"
          value={documentUrl}
          onChange={(e) => setDocumentUrl(e.target.value)}
          placeholder="https://...pdf or https://...docx"
        />
      )}

      {/* GAME */}
      {contentType === "GAME" && (
        <Input
          label="Game URL or embed link"
          value={gameUrl}
          onChange={(e) => setGameUrl(e.target.value)}
          placeholder="https://... or game embed URL"
        />
      )}

      {/* VIDEO (standalone) */}
      {contentType === "VIDEO" && (
        <Input
          label="Video URL"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://...m3u8 or direct video URL"
        />
      )}

      {/* QUIZ_ASSESSMENT */}
      {contentType === "QUIZ_ASSESSMENT" && (
        <Input
          label="Quiz URL or embed (optional)"
          value={documentUrl}
          onChange={(e) => setDocumentUrl(e.target.value)}
          placeholder="https://... or quiz embed URL"
        />
      )}

      {/* Domain */}
      <div>
        <label className="block text-sm font-medium mb-1">Domain</label>
        <select
          value={domainId}
          onChange={(e) => onDomainChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-brand-grey-light bg-white"
        >
          <option value="">— Select domain —</option>
          {domainOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Company assignment — hidden when publicOnly (trainer flow) */}
      {!publicOnly && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={assignToAllCompanies}
              onChange={(e) => onAssignToAllChange(e.target.checked)}
            />
            <span className="text-sm font-medium">Available to all companies</span>
          </label>
          {!assignToAllCompanies && (
            <div className="mt-2 space-y-2 max-h-24 overflow-y-auto">
              {tenants.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tenantIds.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) onTenantChange([...tenantIds, t.id]);
                      else onTenantChange(tenantIds.filter((id) => id !== t.id));
                    }}
                  />
                  <span className="text-sm">{t.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
