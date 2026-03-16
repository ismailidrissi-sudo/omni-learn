import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import {
  getMicrolearningFeed,
  toggleMicrolearningLike,
  getMicrolearningComments,
  addMicrolearningComment,
  recordMicrolearningShare,
} from '../api';

const BRAND = {
  green: '#059669',
  greenLight: '#F5F5DC',
  beige: '#D4B896',
  beigeDark: '#1a1212',
  white: '#F5F5DC',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type MicroItem = {
  id: string;
  title: string;
  type: string;
  mediaId?: string;
  metadata?: string;
  durationMinutes?: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

type Comment = { id: string; userId: string; body: string; createdAt: string };

function parseMetadata(meta: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  try {
    return typeof meta === 'string' ? JSON.parse(meta || '{}') : meta;
  } catch {
    return {};
  }
}

function getVideoUrl(item: MicroItem): string | null {
  const meta = parseMetadata(item.metadata);
  const hlsUrl = meta?.hlsUrl as string | undefined;
  const videoUrl = meta?.videoUrl as string | undefined;
  return hlsUrl || videoUrl || item.mediaId || null;
}

function MicroVideoCard({
  item,
  isActive,
  userId,
  onLike,
  onComment,
  onShare,
}: {
  item: MicroItem;
  isActive: boolean;
  userId: string;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const videoRef = useRef<Video>(null);
  const videoUrl = getVideoUrl(item);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.playAsync();
    } else {
      videoRef.current?.pauseAsync();
    }
  }, [isActive]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this microlearning: ${item.title}`,
        title: item.title,
      });
      onShare(item.id);
    } catch {
      // User cancelled
    }
  };

  return (
    <View style={styles.videoCard}>
      {videoUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
          isMuted={false}
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderText}>No video URL</Text>
          <Text style={styles.placeholderSub}>{item.title}</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onLike(item.id)}
          >
            <Text style={styles.actionIcon}>{item.likedByMe ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionCount}>{item.likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onComment(item.id)}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{item.commentCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Text style={styles.actionIcon}>↗️</Text>
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function MicrolearningsScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const initialIndex = route?.params?.initialIndex ?? 0;
  const [items, setItems] = useState<MicroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList<MicroItem>>(null);
  const [commentModal, setCommentModal] = useState<{ contentId: string; visible: boolean }>({
    contentId: '',
    visible: false,
  });
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const data = await getMicrolearningFeed(userId, 50, 0);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (items.length > 0 && initialIndex > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [items.length, initialIndex]);

  const handleLike = async (contentId: string) => {
    if (!isAuthenticated || !user?.id) {
      navigation.navigate('SignIn', {
        returnTo: 'Microlearnings',
        params: { initialIndex: activeIndex },
      });
      return;
    }
    try {
      const res = await toggleMicrolearningLike(contentId, userId);
      setItems((prev) =>
        prev.map((i) =>
          i.id === contentId
            ? {
                ...i,
                likedByMe: res.liked,
                likeCount: res.liked ? i.likeCount + 1 : i.likeCount - 1,
              }
            : i,
        ),
      );
    } catch {
      // ignore
    }
  };

  const openComments = async (contentId: string) => {
    if (!isAuthenticated || !user?.id) {
      navigation.navigate('SignIn', {
        returnTo: 'Microlearnings',
        params: { initialIndex: activeIndex },
      });
      return;
    }
    setCommentModal({ contentId, visible: true });
    setComments([]);
    try {
      const data = await getMicrolearningComments(contentId);
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !commentModal.contentId) return;
    if (!isAuthenticated || !user?.id) {
      navigation.navigate('SignIn', {
        returnTo: 'Microlearnings',
        params: { initialIndex: activeIndex },
      });
      return;
    }
    setSubmitting(true);
    try {
      const comment = await addMicrolearningComment(commentModal.contentId, userId, newComment.trim());
      setComments((prev) => [{ ...comment, id: comment.id }, ...prev]);
      setNewComment('');
      setItems((prev) =>
        prev.map((i) =>
          i.id === commentModal.contentId ? { ...i, commentCount: i.commentCount + 1 } : i,
        ),
      );
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async (contentId: string) => {
    try {
      await recordMicrolearningShare(contentId, userId);
    } catch {
      // ignore
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No microlearnings yet</Text>
        <Text style={styles.emptyText}>
          Content will appear here once your admin adds MICRO_LEARNING content.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backFloating}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backFloatingText}>← Back</Text>
      </TouchableOpacity>
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <MicroVideoCard
            item={item}
            isActive={index === activeIndex}
            userId={userId}
            onLike={handleLike}
            onComment={openComments}
            onShare={handleShare}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      <Modal
        visible={commentModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentModal({ contentId: '', visible: false })}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => setCommentModal({ contentId: '', visible: false })}
              >
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Text style={styles.commentBody}>{item.body}</Text>
                </View>
              )}
              style={styles.commentList}
            />
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!newComment.trim() || submitting) && styles.sendBtnDisabled]}
                onPress={submitComment}
                disabled={!newComment.trim() || submitting}
              >
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backFloating: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backFloatingText: { color: BRAND.white, fontSize: 16, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.white },
  videoCard: {
    height: SCREEN_HEIGHT,
    width: '100%',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: { color: BRAND.beige, fontSize: 16 },
  placeholderSub: { color: BRAND.white, fontSize: 14, marginTop: 8 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 48,
  },
  info: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: BRAND.white, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  actions: { flexDirection: 'row', gap: 24, alignItems: 'center' },
  actionBtn: { alignItems: 'center' },
  actionIcon: { fontSize: 28, marginBottom: 4 },
  actionCount: { fontSize: 12, color: BRAND.white, fontWeight: '600' },
  actionLabel: { fontSize: 12, color: BRAND.white, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: BRAND.beigeDark, marginBottom: 8 },
  emptyText: { fontSize: 14, color: BRAND.beige, textAlign: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: BRAND.green, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  backBtnText: { color: BRAND.white, fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: BRAND.beigeDark },
  modalClose: { fontSize: 16, color: BRAND.green, fontWeight: '600' },
  commentList: { maxHeight: 200, padding: 16 },
  commentRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  commentBody: { fontSize: 15, color: BRAND.beigeDark },
  commentInputRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: BRAND.green,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: BRAND.white, fontWeight: '600' },
});
