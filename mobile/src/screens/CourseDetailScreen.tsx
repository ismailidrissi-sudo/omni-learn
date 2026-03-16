import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getContent } from '../api';

const BRAND = {
  green: '#059669',
  beige: '#D4B896',
  beigeDark: '#1a1212',
  greenLight: '#F5F5DC',
};

type Course = {
  id: string;
  title: string;
  type: string;
  description?: string;
  durationMinutes?: number;
};

export default function CourseDetailScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { user, isAuthenticated } = useAuth();
  const courseId = route?.params?.courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    getContent(courseId, user?.id)
      .then(setCourse)
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [courseId, user?.id]);

  const handleEnroll = () => {
    if (!isAuthenticated || !user?.id) {
      navigation.navigate('SignIn', { returnTo: 'CourseDetail', params: { courseId } });
      return;
    }
    navigation.navigate('Learn');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Course not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.courseIcon}>
          <Text style={styles.courseIconText}>📚</Text>
        </View>
        <Text style={styles.title}>{course.title}</Text>
        {course.durationMinutes && (
          <Text style={styles.duration}>{course.durationMinutes} min</Text>
        )}
      </View>

      {course.description && (
        <Text style={styles.description}>{course.description}</Text>
      )}

      <TouchableOpacity style={styles.enrollBtn} onPress={handleEnroll}>
        <Text style={styles.enrollBtnText}>Enroll in course</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate('Learn')}
      >
        <Text style={styles.secondaryBtnText}>Browse learning paths</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.greenLight },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.greenLight },
  header: { marginBottom: 24 },
  courseIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: BRAND.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseIconText: { fontSize: 32 },
  title: { fontSize: 22, fontWeight: '700', color: BRAND.beigeDark },
  duration: { fontSize: 14, color: BRAND.beige, marginTop: 8 },
  description: {
    fontSize: 15,
    color: BRAND.beigeDark,
    lineHeight: 22,
    marginBottom: 24,
  },
  enrollBtn: {
    backgroundColor: BRAND.green,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  enrollBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: BRAND.green,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryBtnText: { color: BRAND.green, fontSize: 16, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: BRAND.beigeDark, marginBottom: 16 },
  backBtn: { backgroundColor: BRAND.green, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
