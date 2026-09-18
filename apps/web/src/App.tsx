import { RuntimeProvider } from './platform/RuntimeProvider';
import { AppProvider } from './state/AppContext';
import { Shell } from './components/Shell';

export default function App() {
  return (
    <RuntimeProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </RuntimeProvider>
  );
}
