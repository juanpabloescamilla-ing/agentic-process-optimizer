import './globals.css';
export const metadata = { title: 'Process Optimizer', description: 'Del trabajo cotidiano a una intervención comprobable.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
