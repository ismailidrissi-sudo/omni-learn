import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getAssignedContent } from '../api';

const BRAND = {
  green: '#059669',
  greenLight: '#F5F5DC',
  beige: '#D4B896',
  beigeDark: '#1a1212',
  white: '#F5F5DC',
};

type MicroItem = {
  id: string;
  title: string;
  type: string;
  likeCount?: number;
  commentCount?: number;
};

type AssignedData = {
  paths: { id: string; name: string; steps: { id: string; title: string; type: string }[] }[];
  microlearnings: MicroItem[];
};

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const { user, signOut, isAuthenticated } = useAuth();
  const [data, setData] = useState<AssignedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userId = user?.id ?? 'anonymous';

  const load = async () => {
    try {
      const d = await getAssignedContent(userId);
      setData(d);
    } catch {
      setData({ paths: [], microlearnings: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.green} />
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
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{isAuthenticated ? 'Welcome back,' : 'Hello,'}</Text>
          <Text style={styles.userName}>{user?.name ?? 'Learner'}</Text>
        </View>
        {isAuthenticated ? (
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signOutBtn} onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.signOutText}>Sign in</Text>
          </TouchableOpacity>
        )}
      </View>

      {data?.microlearnings && data.microlearnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Microlearnings</Text>
          <Text style={styles.sectionSubtitle}>Short professional videos</Text>
          <TouchableOpacity
            style={styles.primaryCard}
            onPress={() => navigation.navigate('Microlearnings')}
          >
            <Text style={styles.primaryCardTitle}>Browse Microlearnings</Text>
            <Text style={styles.primaryCardSubtitle}>
              {data.microlearnings.length} video{data.microlearnings.length !== 1 ? 's' : ''}{' '}
              available
            </Text>
            <Text style={styles.primaryCardCta}>Open feed →</Text>
          </TouchableOpacity>
        </View>
      )}

      {data?.paths && data.paths.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your learning paths</Text>
          {data.paths.map((path) => (
            <View key={path.id} style={styles.pathCard}>
              <Text style={styles.pathName}>{path.name}</Text>
              <Text style={styles.pathSteps}>
                {path.steps.length} step{path.steps.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            style={styles.pathLink}
            onPress={() => navigation.navigate('Learn')}
          >
            <Text style={styles.pathLinkText}>View suggested paths →</Text>
          </TouchableOpacity>
        </View>
      )}

      {(!data?.microlearnings?.length && !data?.paths?.length) && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No assigned content yet</Text>
          <Text style={styles.emptyText}>
            Enroll in learning paths on the web app, or ask your admin to assign content.
          </Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Microlearnings')}
          >
            <Text style={styles.secondaryBtnText}>Browse all microlearnings</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5DC' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  greeting: { fontSize: 14, color: BRAND.beige },
  userName: { fontSize: 22, fontWeight: '700', color: BRAND.beigeDark },
  signOutBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  signOutText: { fontSize: 14, color: BRAND.green, fontWeight: '600' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: BRAND.beigeDark, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: BRAND.beige, marginBottom: 12 },
  primaryCard: {
    backgroundColor: BRAND.greenLight,
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.green,
  },
  primaryCardTitle: { fontSize: 18, fontWeight: '700', color: BRAND.beigeDark },
  primaryCardSubtitle: { fontSize: 14, color: BRAND.beige, marginTop: 4 },
  primaryCardCta: { fontSize: 14, color: BRAND.green, fontWeight: '600', marginTop: 8 },
  pathCard: {
    backgroundColor: '#F5F5DC',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  pathName: { fontSize: 16, fontWeight: '600', color: BRAND.beigeDark },
  pathSteps: { fontSize: 13, color: BRAND.beige, marginTop: 4 },
  pathLink: { marginTop: 12 },
  pathLinkText: { fontSize: 14, color: BRAND.green, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: BRAND.beigeDark, marginBottom: 8 },
  emptyText: { fontSize: 14, color: BRAND.beige, textAlign: 'center', marginBottom: 20 },
  secondaryBtn: {
    backgroundColor: BRAND.green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  secondaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
