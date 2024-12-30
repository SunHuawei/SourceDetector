import { createBrowserRouter } from 'react-router-dom';
import Home from './pages/Home';
import SourceFiles from './pages/SourceFiles';
import CrxFiles from './pages/CrxFiles';
import Layout from './components/Layout';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                path: '/',
                element: <Home />
            },
            {
                path: '/source-files',
                element: <SourceFiles />
            },
            {
                path: '/crx-files',
                element: <CrxFiles />
            }
        ]
    }
]); 