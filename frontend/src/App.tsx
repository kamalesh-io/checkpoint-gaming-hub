import { useEffect, useRef } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VirtualKeyboardModal } from '@/components/controller/VirtualKeyboardModal';
import { useGlobalControllerNavigation } from '@/hooks/useSpatialNavigation';
import { AppRouter } from '@/routes/AppRouter';
import { ROUTES } from '@/routes/routes';
import { useControllerStore } from '@/stores/controllerStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

function ControllerRuntimeHost() {
  const navigate = useNavigate();
  const location = useLocation();
  const startInBigPicture = useControllerStore((s) => s.startInBigPicture);
  const checkedBootRedirect = useRef(false);

  useGlobalControllerNavigation();

  useEffect(() => {
    if (checkedBootRedirect.current) return;
    checkedBootRedirect.current = true;
    if (startInBigPicture && location.pathname === ROUTES.OVERVIEW) {
      navigate(ROUTES.BIG_PICTURE, { replace: true });
    }
  }, [startInBigPicture, location.pathname, navigate]);

  return <VirtualKeyboardModal />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ControllerRuntimeHost />
        <AppRouter />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
