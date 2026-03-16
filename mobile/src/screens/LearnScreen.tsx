import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getPathSuggestions } from '../api';

const BRAND = { green: '#059669', beige: '#D4B896', beigeDark: '#1a1212' };

export default function LearnScreen({ navigation }: { navigation: any }) {
  const [paths, setPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPathSuggestions('user-1')
      .then((data) => (Array.isArray(data) ? data : []))
      .then(setPaths)
      .catch(() => setPaths([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggested for you</Text>
      {paths.length === 0 ? (
        <Text style={styles.empty}>No path suggestions yet. Enroll in paths on the web app.</Text>
      ) : (
        <FlatList
          data={paths}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDomain}>{item.domain}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5DC', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: BRAND.beigeDark, marginBottom: 16 },
  empty: { color: BRAND.beige, fontSize: 14 },
  card: {
    backgroundColor: '#F5F5DC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.green,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: BRAND.beigeDark },
  cardDomain: { fontSize: 12, color: BRAND.beige, marginTop: 4 },
});
