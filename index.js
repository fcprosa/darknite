import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';

import App from './App';

// Wrap App with NavigationContainer for React Navigation
const AppWithNavigation = () => (
  <NavigationContainer>
    <App />
  </NavigationContainer>
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppWithNavigation);
