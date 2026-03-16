import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { semanticSearch } from '../api';

const BRAND = { green: '#059669', beige: '#D4B896', beigeDark: '#C4A574' };

export default function SearchScreen({ navigation }: { navigation: any }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = () => {
    if (!query.trim()) return;
    setLoading(true);
    semanticSearch(query)
      .then((data) => (Array.isArray(data) ? data : []))
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search courses..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={BRAND.green} style={styles.loader} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardType}>{item.type}</Text>
            </View>
          )}
          ListEmptyComponent={
            query ? (
              <Text style={styles.empty}>No results for "{query}"</Text>
            ) : (
              <Text style={styles.hint}>Enter a search term for semantic search</Text>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5DC', padding: 20 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.beige,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: BRAND.green,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: '#F5F5DC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: BRAND.beigeDark },
  cardType: { fontSize: 12, color: BRAND.beige, marginTop: 4 },
  empty: { color: BRAND.beige, textAlign: 'center', marginTop: 24 },
  hint: { color: BRAND.beige, textAlign: 'center', marginTop: 24 },
});
