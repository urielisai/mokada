import { useEffect, useState, type FormEvent, type PointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import logoMokada from '../../../assets/logo.svg';
import productoAmortiguador from '../../../assets/login/producto-amortiguador.png';
import productoBateria from '../../../assets/login/producto-bateria.png';
import productoDiscoFreno from '../../../assets/login/producto-disco-freno.png';
import productoFaro from '../../../assets/login/producto-faro.png';
import { useAuth } from '../context/useAuth';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

interface ProductLayer {
  src: string;
  alt: string;
  depth: number;
  delay: number;
  widthClassName: string;
  startTransform: string;
  finalTransform: string;
}

export const LoginPage = () => {
  const { signIn, session, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as LocationState | null;
  const redirectTo = state?.from?.pathname || '/';

  useEffect(() => {
    if (session && profile) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, profile, redirectTo, session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
        <section className="hidden overflow-hidden bg-canvas lg:block">
          <LoginParallaxShowcase />
        </section>

        <section className="flex items-center justify-center bg-white px-5 py-10 sm:px-8 lg:shadow-[-0.5px_0_0_rgb(0_0_0/0.08)]">
          <div className="w-full max-w-[380px] stagger">
            <div className="mb-9">
              <img src={logoMokada} alt="Mokada" className="mb-8 h-auto w-36 lg:hidden" />
              <h2 className="text-[34px] font-semibold tracking-[-0.03em]">Iniciar sesión</h2>
              <p className="mt-2 text-[15px] text-muted">Entra con tu correo y contraseña.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Correo</span>
                <div className="flex items-center rounded-xl border border-transparent bg-gray-100 px-3.5 transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-accent/60 focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/15">
                  <Mail className="h-4 w-4 text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Contraseña</span>
                <div className="flex items-center rounded-xl border border-transparent bg-gray-100 px-3.5 transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-accent/60 focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/15">
                  <Lock className="h-4 w-4 text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </label>

              {errorMessage && (
                <div role="alert" className="animate-pop-in rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="!mt-6 flex h-12 w-full items-center justify-center rounded-full bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </button>
              <p className="pt-1 text-center text-[12px] font-medium text-gray-400 lg:hidden">
                Developed by Nizana Studio
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};

const productLayers: ProductLayer[] = [
  {
    src: productoDiscoFreno,
    alt: 'Disco de freno',
    depth: 22,
    delay: 0,
    widthClassName: 'w-[min(35vw,310px)]',
    startTransform: 'translate3d(calc(-50% - 34vw), calc(-50% - 31vh), -180px) rotate(-22deg) scale(0.72)',
    finalTransform: 'translate3d(calc(-50% - 166px), calc(-50% - 54px), 0) rotate(-8deg) scale(0.72)',
  },
  {
    src: productoBateria,
    alt: 'Bateria',
    depth: 14,
    delay: 180,
    widthClassName: 'w-[min(38vw,340px)]',
    startTransform: 'translate3d(calc(-50% + 36vw), calc(-50% + 26vh), -180px) rotate(16deg) scale(0.7)',
    finalTransform: 'translate3d(calc(-50% + 116px), calc(-50% + 134px), 0) rotate(3deg) scale(0.6)',
  },
  {
    src: productoFaro,
    alt: 'Faro',
    depth: 18,
    delay: 360,
    widthClassName: 'w-[min(42vw,375px)]',
    startTransform: 'translate3d(calc(-50% + 40vw), calc(-50% - 24vh), -180px) rotate(-10deg) scale(0.68)',
    finalTransform: 'translate3d(calc(-50% + 178px), calc(-50% - 92px), 0) rotate(7deg) scale(0.58)',
  },
  {
    src: productoAmortiguador,
    alt: 'Amortiguador',
    depth: 28,
    delay: 540,
    widthClassName: 'w-[min(17vw,150px)]',
    startTransform: 'translate3d(calc(-50% - 29vw), calc(-50% + 32vh), -180px) rotate(28deg) scale(0.76)',
    finalTransform: 'translate3d(calc(-50% - 126px), calc(-50% + 126px), 0) rotate(20deg) scale(0.58)',
  },
];

const LoginParallaxShowcase = () => {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setHasAnimatedIn(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setPointer({ x, y });
  };

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,243,249,0.98))]"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPointer({ x: 0, y: 0 })}
    >
      <div className="absolute left-8 top-6 z-20">
        <img src={logoMokada} alt="Mokada" className="h-auto w-36" />
      </div>
      <div className="absolute inset-0 perspective-[1200px]" aria-hidden="true">
        {productLayers.map((product) => (
          <div
            key={product.alt}
            className="absolute inset-0 transition-transform duration-[180ms] ease-out will-change-transform"
            style={{
              transform: `translate3d(${pointer.x * product.depth}px, ${pointer.y * product.depth}px, 0)`,
            }}
          >
            <img
              src={product.src}
              alt={product.alt}
              className={`absolute left-1/2 top-1/2 max-w-none object-contain transition-[transform,opacity,filter] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity,filter] motion-reduce:opacity-100 motion-reduce:blur-0 motion-reduce:transition-none ${product.widthClassName} ${
                hasAnimatedIn
                  ? 'opacity-100 blur-0 drop-shadow-[0_30px_38px_rgba(28,35,45,0.24)]'
                  : 'opacity-0 blur-[2px] drop-shadow-[0_28px_36px_rgba(28,35,45,0.08)]'
              }`}
              style={{
                transitionDelay: `${product.delay}ms`,
                transform: hasAnimatedIn ? product.finalTransform : product.startTransform,
              }}
            />
          </div>
        ))}

        <div
          className="absolute inset-0 z-10 flex items-center justify-center transition-transform duration-[180ms] ease-out will-change-transform"
          style={{
            transform: `translate3d(${pointer.x * -10}px, ${pointer.y * -10}px, 0)`,
          }}
        >
          <img
            src={logoMokada}
            alt="Mokada"
            className={`h-auto w-[min(38vw,315px)] max-w-[70%] drop-shadow-[0_18px_24px_rgba(28,35,45,0.22)] transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity] motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none ${
              hasAnimatedIn ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.88] opacity-0'
            }`}
            style={{ transitionDelay: '760ms' }}
          />
        </div>
      </div>
      <div className="absolute bottom-10 left-8 z-20 max-w-sm">
        <p className="text-[13px] font-semibold text-accent">Autopartes</p>
        <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.035em] text-ink">Acceso operativo</h1>
        <p className="mt-4 text-[15px] leading-6 text-muted">
          Gestiona catálogo, inventario y usuarios con cuentas verificadas por correo.
        </p>
      </div>
    </div>
  );
};
