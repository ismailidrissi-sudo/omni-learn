import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import SignInPromptModal from '../components/SignInPromptModal';
import {
  getTrendingMicrolearnings,
  getTrendingCourses,
  getMicrolearningFeed,
} from '../api';

const BRAND = {
  green: '#059669',
  beige: '#D4B896',
  beigeDark: '#1a1212',
  greenLight: '#F5F5DC',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MICRO_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2 - 8;
const MICRO_CARD_HEIGHT = MICRO_CARD_WIDTH * 1.2;

type MicroItem = {
  id: string;
  title: string;
  type: string;
  metadata?: string;
  mediaId?: string;
  durationMinutes?: number;
  likeCount?: number;
  commentCount?: number;
};

type CourseItem = {
  id: string;
  title: string;
  type: string;
  durationMinutes?: number;
  description?: string;
};

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

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { isAuthenticated, user } = useAuth();
  const [trendingMicro, setTrendingMicro] = useState<MicroItem[]>([]);
  const [trendingCourses, setTrendingCourses] = useState<CourseItem[]>([]);
  const [allMicro, setAllMicro] = useState<MicroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{
    visible: boolean;
    type: 'micro' | 'course';
    item?: MicroItem | CourseItem;
    index?: number;
  }>({ visible: false, type: 'micro' });

  const userId = user?.id ?? 'anonymous';

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [micro, courses, feed] = await Promise.all([
        getTrendingMicrolearnings(4),
        getTrendingCourses(3),
        getMicrolearningFeed(userId, 20, 0),
      ]);
      setTrendingMicro(micro);
      setTrendingCourses(courses);
      setAllMicro(Array.isArray(feed) ? feed : []);
    } catch (err) {
      setTrendingMicro([]);
      setTrendingCourses([]);
      setAllMicro([]);
      setLoadError('Could not load content. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMicroPress = (item: MicroItem, index: number) => {
    if (!isAuthenticated) {
      setAuthModal({ visible: true, type: 'micro', item, index });
      return;
    }
    const items = trendingMicro.length > 0 ? trendingMicro : allMicro.slice(0, 20);
    const idx = items.findIndex((m) => m.id === item.id);
    navigation.navigate('Microlearnings', { initialIndex: idx >= 0 ? idx : 0 });
  };

  const handleCoursePress = (item: CourseItem) => {
    if (!isAuthenticated) {
      setAuthModal({ visible: true, type: 'course', item });
      return;
    }
    navigation.navigate('CourseDetail', { courseId: item.id });
  };

  const handleSignIn = () => {
    setAuthModal((m) => ({ ...m, visible: false }));
    navigation.navigate('SignIn', { returnTo: 'Home' });
  };

  const handleSignUp = () => {
    setAuthModal((m) => ({ ...m, visible: false }));
    navigation.navigate('SignIn', { returnTo: 'Home', mode: 'signup' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); loadData(); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND.green]} />
      }
    >
      {/* Welcome section */}
      <View style={styles.welcome}>
        <Text style={styles.welcomeTitle}>Welcome to Omni Learn</Text>
        <Text style={styles.welcomeSubtitle}>
          {isAuthenticated ? `Hello, ${user?.name ?? 'Learner'}!` : 'Unleash your potential'}
        </Text>
        {!isAuthenticated && (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.signInBtnText}>Sign in with Google</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trending Micro-Learnings - horizontal list of 4 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Micro-Learnings</Text>
        <Text style={styles.sectionSubtitle}>Short videos to learn on the go</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {(trendingMicro.length > 0 ? trendingMicro : allMicro.slice(0, 4)).map((item, index) => (
            <MicroThumbnail
              key={item.id}
              item={item}
              onPress={() => handleMicroPress(item, index)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Trending Courses - 3 courses grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Courses</Text>
        <Text style={styles.sectionSubtitle}>Deep-dive into new skills</Text>
        <View style={styles.courseGrid}>
          {trendingCourses.map((item) => (
            <CourseCard key={item.id} item={item} onPress={() => handleCoursePress(item)} />
          ))}
        </View>
      </View>

      {/* All content - more microlearnings */}
      {allMicro.length > 4 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More to explore</Text>
          <Text style={styles.sectionSubtitle}>Browse all microlearnings</Text>
          <TouchableOpacity
            style={styles.browseCard}
            onPress={() => {
              if (!isAuthenticated) {
                setAuthModal({ visible: true, type: 'micro' });
                return;
              }
              navigation.navigate('Microlearnings');
            }}
          >
            <Text style={styles.browseCardTitle}>Open video feed</Text>
            <Text style={styles.browseCardSubtitle}>
              {allMicro.length} videos • Swipe through like TikTok
            </Text>
            <Text style={styles.browseCardCta}>Start watching →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom nav links */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
          <Text style={styles.footerLink}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate(isAuthenticated ? 'Dashboard' : 'SignIn')}>
          <Text style={styles.footerLink}>{isAuthenticated ? 'My Learning' : 'Sign in'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Learn')}>
          <Text style={styles.footerLink}>Suggested paths</Text>
        </TouchableOpacity>
      </View>

      <SignInPromptModal
        visible={authModal.visible}
        onClose={() => setAuthModal((m) => ({ ...m, visible: false }))}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        message={
          authModal.type === 'micro'
            ? 'Sign in to watch micro-learning videos in our TikTok-style feed.'
            : 'Sign in to enroll in courses and track your progress.'
        }
      />
    </ScrollView>
  );
}

function MicroThumbnail({ item, onPress }: { item: MicroItem; onPress: () => void }) {
  const videoUrl = getVideoUrl(item);
  return (
    <TouchableOpacity style={styles.microCard} onPress={onPress} activeOpacity={0.9}>
      {videoUrl ? (
        <Video
          source={{ uri: videoUrl }}
          style={styles.microThumb}
          resizeMode={ResizeMode.COVER}
          isMuted
          isLooping
          shouldPlay={false}
        />
      ) : (
        <View style={styles.microPlaceholder}>
          <Text style={styles.microPlaceholderIcon}>▶</Text>
        </View>
      )}
      <View style={styles.microOverlay}>
        <Text style={styles.microTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.durationMinutes && (
          <Text style={styles.microDuration}>{item.durationMinutes} min</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CourseCard({ item, onPress }: { item: CourseItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.courseCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.courseIcon}>
        <Text style={styles.courseIconText}>📚</Text>
      </View>
      <Text style={styles.courseTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {item.durationMinutes && (
        <Text style={styles.courseDuration}>{item.durationMinutes} min</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.greenLight },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.greenLight },
  welcome: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: BRAND.green,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  signInBtn: {
    marginTop: 16,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  signInBtnText: {
    color: BRAND.green,
    fontSize: 16,
    fontWeight: '600',
  },
  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: BRAND.beigeDark, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: BRAND.beige, marginBottom: 12 },
  horizontalList: { gap: 12, paddingRight: 20 },
  microCard: {
    width: MICRO_CARD_WIDTH,
    height: MICRO_CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  microThumb: { width: '100%', height: '100%' },
  microPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  microPlaceholderIcon: { fontSize: 32, color: BRAND.beige },
  microOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  microTitle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  microDuration: { fontSize: 11, color: BRAND.beige, marginTop: 2 },
  courseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  courseCard: {
    width: (SCREEN_WIDTH - 40 - 24) / 3,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  courseIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: BRAND.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseIconText: { fontSize: 18 },
  courseTitle: { fontSize: 13, fontWeight: '600', color: BRAND.beigeDark },
  courseDuration: { fontSize: 11, color: BRAND.beige, marginTop: 4 },
  browseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.green,
  },
  browseCardTitle: { fontSize: 16, fontWeight: '700', color: BRAND.beigeDark },
  browseCardSubtitle: { fontSize: 14, color: BRAND.beige, marginTop: 4 },
  browseCardCta: { fontSize: 14, color: BRAND.green, fontWeight: '600', marginTop: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 24,
    marginTop: 8,
  },
  footerLink: { fontSize: 14, color: BRAND.green, fontWeight: '600' },
  errorText: { fontSize: 16, color: BRAND.beigeDark, textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: BRAND.green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
