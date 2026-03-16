import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AuthProvider } from './src/context/AuthContext';
import HomeScreen from './src/screens/HomeScreen';
import SignInScreen from './src/screens/SignInScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MicrolearningsScreen from './src/screens/MicrolearningsScreen';
import LearnScreen from './src/screens/LearnScreen';
import SearchScreen from './src/screens/SearchScreen';
import CourseDetailScreen from './src/screens/CourseDetailScreen';

const Stack = createNativeStackNavigator();

const NAV_THEME: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: '#059669' },
  headerTintColor: '#F5F5DC',
  headerTitleStyle: { fontWeight: '600' },
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={NAV_THEME}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Omnilearn' }} />
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'My Learning' }} />
          <Stack.Screen name="Microlearnings" component={MicrolearningsScreen} options={{ title: 'Microlearnings', headerShown: false }} />
          <Stack.Screen name="Learn" component={LearnScreen} options={{ title: 'Suggested Paths' }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Semantic Search' }} />
          <Stack.Screen name="CourseDetail" component={CourseDetailScreen} options={{ title: 'Course' }} />
        </Stack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
    </AuthProvider>
  );
}
