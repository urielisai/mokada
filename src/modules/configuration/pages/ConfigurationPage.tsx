import { Link } from "react-router-dom";
import {
  Ruler,
  BadgeDollarSign,
  Settings as SettingsIcon,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../../auth/context/useAuth";

export const ConfigurationPage = () => {
  const { isAdmin } = useAuth();

  const configModules = [
    {
      title: "Unidades de Medida",
      description: "Gestión de unidades para inventario y productos.",
      icon: Ruler,
      path: "/config/units",
    },
    {
      title: "Listas de Precios",
      description: "Configuración de niveles de precios y descuentos especiales.",
      icon: BadgeDollarSign,
      path: "/config/price-lists",
    },
    {
      title: "Atributos Dinámicos",
      description: "Definición de características configurables para productos.",
      icon: SettingsIcon,
      path: "/config/attributes",
    },
  ];

  if (isAdmin) {
    configModules.push({
      title: "Usuarios y Permisos",
      description: "Gestión de accesos y roles del sistema.",
      icon: ShieldCheck,
      path: "/admin/users",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
          Configuración del Sistema
        </h2>
        <p className="text-[15px] text-[#86868B] mt-1">
          Administra los catálogos base, preferencias y seguridad de tu cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {configModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.path}
              to={module.path}
              className="group block bg-white border border-gray-200/60 rounded-2xl p-6 transition-all duration-200 hover:shadow-md hover:border-[#0066CC]/30"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 text-[#1D1D1F] transition-transform group-hover:scale-110 duration-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="p-2 text-gray-300 group-hover:text-[#0066CC] transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-[17px] font-semibold text-[#1D1D1F] group-hover:text-[#0066CC] transition-colors">
                  {module.title}
                </h3>
                <p className="text-[14px] text-[#86868B] mt-1.5 leading-relaxed">
                  {module.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
