import type { LucideIcon } from "lucide-react";
import {
    ArrowLeftRight,
    Database,
    Factory,
    History,
    Home,
    ListOrdered,
    PackageCheck,
    Thermometer,
    Truck,
    Users,
    Wrench
} from "lucide-react";
import { ROLES } from "./permissions";
import type { Rol } from "./permissions";

// ============================================================================
// MENÚ LATERAL
// ============================================================================
// Una sola fuente para el menú Y para las rutas: App.tsx genera las rutas a
// partir de esta lista, así un módulo nuevo se agrega en un solo lugar.
//
// rolMinimo replica los permisos del backend. Ocultar la opción es solo
// comodidad; quien protege de verdad es el backend.
// ============================================================================

export interface SubItemMenu {
    etiqueta: string;
    ruta: string;
    rolMinimo: Rol;
}

export interface ItemMenu extends SubItemMenu {
    icono: LucideIcon;
    hijos?: SubItemMenu[];
}

export const MENU: ItemMenu[] = [
    { etiqueta: "Inicio", ruta: "/", icono: Home, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Recepciones", ruta: "/recepciones", icono: Truck, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Cola de cámara", ruta: "/cola", icono: ListOrdered, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Producción", ruta: "/produccion", icono: Factory, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Movimientos", ruta: "/movimientos", icono: ArrowLeftRight, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Despachos", ruta: "/despachos", icono: PackageCheck, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Bloques y pulpeos", ruta: "/pulpeos", icono: Thermometer, rolMinimo: ROLES.OPERATIVO },
    { etiqueta: "Mantenimientos", ruta: "/mantenimientos", icono: Wrench, rolMinimo: ROLES.OPERATIVO },
    {
        etiqueta: "Catálogos",
        ruta: "/catalogos",
        icono: Database,
        rolMinimo: ROLES.COORDINADOR,
        hijos: [
            { etiqueta: "Productores", ruta: "/catalogos/productores", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Fincas", ruta: "/catalogos/fincas", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "SKU", ruta: "/catalogos/sku", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Clientes / CEDIS", ruta: "/catalogos/cedis", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Transportes", ruta: "/catalogos/transportes", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Líneas fleteras", ruta: "/catalogos/lineas-fleteras", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Operadores", ruta: "/catalogos/operadores", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Tractocamiones", ruta: "/catalogos/tractocamiones", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Cajas refrigeradas", ruta: "/catalogos/cajas-refrigeradas", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Cámaras", ruta: "/catalogos/camaras", rolMinimo: ROLES.COORDINADOR },
            { etiqueta: "Empleados", ruta: "/catalogos/empleados", rolMinimo: ROLES.COORDINADOR }
        ]
    },
    { etiqueta: "Usuarios", ruta: "/usuarios", icono: Users, rolMinimo: ROLES.ADMIN },
    { etiqueta: "Bajas e historial", ruta: "/bajas", icono: History, rolMinimo: ROLES.ADMIN }
];

/** Todas las rutas navegables (los grupos no son página: sus hijos sí). */
export const RUTAS_MENU: SubItemMenu[] = MENU.flatMap((item) =>
    item.hijos ? item.hijos : [item]
);
