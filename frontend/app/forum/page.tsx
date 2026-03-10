"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LearnLogo } from "@/components/ui/learn-logo";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NavToggles } from "@/components/ui/nav-toggles";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Channel = { id: string; name: string; slug: string; description?: string; _count?: { topics: number } };
type Topic = { id: string; title: string; authorId: string; status: string; createdAt: string; _count?: { posts: number } };
type Post = { id: string; body: string; authorId: string; createdAt: string };

export default function ForumPage() {
  const { t } = useI18n();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; title: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicBody, setNewTopicBody] = useState("");
  const [newPostBody, setNewPostBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelSlug, setNewChannelSlug] = useState("");

  useEffect(() => {
    fetch(`${API}/forum/channels`)
      .then((r) => r.json())
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    fetch(`${API}/forum/channels/${selectedChannel}/topics`)
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [selectedChannel]);

  useEffect(() => {
    if (!selectedTopic) return;
    fetch(`${API}/forum/topics/${selectedTopic.id}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]));
  }, [selectedTopic?.id]);

  const createTopic = () => {
    if (!selectedChannel || !newTopicTitle.trim() || !newTopicBody.trim()) return;
    fetch(`${API}/forum/channels/${selectedChannel}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: "user-1", title: newTopicTitle, body: newTopicBody }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: r.statusText }));
          throw new Error(err.message || `Failed to create topic (${r.status})`);
        }
        return r.json();
      })
      .then(() => {
        setNewTopicTitle("");
        setNewTopicBody("");
        fetch(`${API}/forum/channels/${selectedChannel}/topics`).then((r) => r.json()).then(setTopics);
      })
      .catch((e) => alert(e.message || "Failed to create topic"));
  };

  const createChannel = () => {
    if (!newChannelName.trim() || !newChannelSlug.trim()) return;
    fetch(`${API}/forum/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newChannelName, slug: newChannelSlug }),
    })
      .then((r) => r.json())
      .then(() => {
        setNewChannelName("");
        setNewChannelSlug("");
        setShowCreateChannel(false);
        fetch(`${API}/forum/channels`).then((r) => r.json()).then(setChannels);
      });
  };

  const addPost = () => {
    if (!selectedTopic || !newPostBody.trim()) return;
    fetch(`${API}/forum/topics/${selectedTopic.id}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: "user-1", body: newPostBody }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: r.statusText }));
          throw new Error(err.message || `Failed to add post (${r.status})`);
        }
        return r.json();
      })
      .then(() => {
        setNewPostBody("");
        fetch(`${API}/forum/topics/${selectedTopic.id}`).then((r) => r.json()).then((d) => setPosts(d.posts || []));
        if (selectedChannel) fetch(`${API}/forum/channels/${selectedChannel}/topics`).then((r) => r.json()).then(setTopics);
      })
      .catch((e) => alert(e.message || "Failed to add post"));
  };

  const moderate = (targetType: "TOPIC" | "POST", targetId: string, action: string) => {
    fetch(`${API}/forum/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, action, moderatorId: "user-1", reason: "Moderated" }),
    }).then(() => {
      if (targetType === "TOPIC") {
        setSelectedTopic(null);
        fetch(`${API}/forum/channels/${selectedChannel}/topics`).then((r) => r.json()).then(setTopics);
      } else {
        fetch(`${API}/forum/topics/${selectedTopic?.id}`).then((r) => r.json()).then((d) => setPosts(d.posts || []));
      }
    });
  };

  const pinTopic = (topicId?: string) => {
    const id = topicId ?? selectedTopic?.id;
    if (!id) return;
    fetch(`${API}/forum/topics/${id}/pin`, { method: "PUT" }).then(() => {
      if (selectedChannel) {
        fetch(`${API}/forum/channels/${selectedChannel}/topics`).then((r) => r.json()).then(setTopics);
      }
    });
  };

  const closeTopic = (topicId?: string) => {
    const id = topicId ?? selectedTopic?.id;
    if (!id) return;
    fetch(`${API}/forum/topics/${id}/close`, { method: "PUT" }).then(() => {
      if (selectedTopic?.id === id) setSelectedTopic(null);
      selectedChannel && fetch(`${API}/forum/channels/${selectedChannel}/topics`).then((r) => r.json()).then(setTopics);
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-brand-grey-light px-6 py-4 flex justify-between items-center">
        <Link href="/">
          <LearnLogo size="md" variant="purple" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/learn">
            <Button variant="ghost" size="sm">{t("nav.learn")}</Button>
          </Link>
          <Link href="/trainer"><Button variant="ghost" size="sm">{t("nav.trainer")}</Button></Link>
          <Link href="/admin/paths">
            <Button variant="outline" size="sm">{t("nav.admin")}</Button>
          </Link>
          <div className="flex items-center gap-1 pl-4 ml-4 border-l border-brand-grey-light">
            <NavToggles />
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-brand-grey-dark mb-6">{t("forum.title")}</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("forum.channels")}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCreateChannel(!showCreateChannel)}>
                + {t("common.new")}
              </Button>
            </CardHeader>
            <CardContent>
              {showCreateChannel && (
                <div className="border-b pb-4 mb-4">
                  <Input placeholder={t("forum.channelName")} value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} className="mb-2" />
                  <Input placeholder={t("forum.slug")} value={newChannelSlug} onChange={(e) => setNewChannelSlug(e.target.value)} className="mb-2" />
                  <Button size="sm" onClick={createChannel}>{t("common.create")}</Button>
                </div>
              )}
              {loading ? (
                <p className="text-brand-grey text-sm">{t("common.loading")}</p>
              ) : channels.length === 0 ? (
                <p className="text-brand-grey text-sm">{t("forum.noChannels")}</p>
              ) : (
                <div className="space-y-2">
                  {channels.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedChannel(c.id); setSelectedTopic(null); }}
                      className={`w-full text-left px-3 py-2 rounded-lg ${selectedChannel === c.id ? "bg-brand-purple/10 text-brand-purple" : "hover:bg-brand-grey-light/50"}`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-brand-grey text-sm ml-2">({c._count?.topics ?? 0})</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedChannel ? (selectedTopic ? selectedTopic.title : t("forum.topics")) : t("forum.selectChannel")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedChannel && (
                <p className="text-brand-grey text-sm">{t("forum.selectChannelToView")}</p>
              )}
              {selectedChannel && !selectedTopic && (
                <>
                  <div className="space-y-2 mb-4">
                    {topics.map((topic) => (
                      <div key={topic.id} className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTopic({ id: topic.id, title: topic.title })}
                          className="flex-1 text-left px-3 py-2 rounded-lg hover:bg-brand-grey-light/50 flex justify-between"
                        >
                          <span>{topic.title}</span>
                          <Badge variant="stardust">{topic._count?.posts ?? 0} {t("common.posts")}</Badge>
                        </button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); pinTopic(topic.id); }} title="Pin">📌</Button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium mb-2">{t("forum.newTopic")}</p>
                    <Input
                      placeholder={t("forum.titlePlaceholder")}
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                      className="mb-2"
                    />
                    <textarea
                      placeholder={t("forum.bodyPlaceholder")}
                      value={newTopicBody}
                      onChange={(e) => setNewTopicBody(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm min-h-[80px] mb-2"
                    />
                    <Button size="sm" onClick={createTopic}>{t("forum.post")}</Button>
                  </div>
                </>
              )}
              {selectedTopic && (
                <>
                  <div className="flex gap-2 mb-4">
                    <Button size="sm" variant="outline" onClick={() => pinTopic()}>{t("forum.pinTopic")}</Button>
                    <Button size="sm" variant="outline" onClick={() => closeTopic()}>{t("forum.closeTopic")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => moderate("TOPIC", selectedTopic.id, "HIDE")}>{t("common.hide")}</Button>
                  </div>
                  <div className="space-y-4 mb-4 max-h-64 overflow-y-auto">
                    {posts.map((p) => (
                      <div key={p.id} className="border-l-2 border-brand-purple/30 pl-3 py-1 flex justify-between group">
                        <div>
                          <p className="text-sm text-brand-grey-dark">{p.body}</p>
                          <p className="text-xs text-brand-grey mt-1">{t("forum.by")} {p.authorId} · {new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => moderate("POST", p.id, "HIDE")}>{t("common.hide")}</Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => moderate("POST", p.id, "DELETE")}>{t("common.delete")}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4">
                    <textarea
                      placeholder={t("forum.replyPlaceholder")}
                      value={newPostBody}
                      onChange={(e) => setNewPostBody(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm min-h-[60px] mb-2"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addPost}>{t("forum.reply")}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedTopic(null)}>{t("forum.backToTopics")}</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
