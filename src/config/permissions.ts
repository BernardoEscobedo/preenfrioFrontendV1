import type { Usuario } from "../types/auth";

// ============================================================================
// ROLES · réplica de la jerarquía del backend (jwt.middleware.js)
// ============================================================================
//   1 Admin ⊂ 2 Coordinador ⊂ 3 Supervisor ⊂ 4 Operativo
// Menor número = más privilegios.
//
// ⚠️ Solo decide QUÉ SE MUESTRA. La seguridad real está en el backend.
// Se usa un objeto "as const" en vez de enum porque la plantilla de Vite
// activa erasableSyntaxOnly, que no permite enums.
// ============================================================================

export const ROLES = {
    ADMIN: 1,
    COORDINADOR: 2,
    SUPERVISOR: 3,
    OPERATIVO: 4
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export const NOMBRE_ROL: Record<number, string> = {
    1: "Administrador",
    2: "Coordinador",
    3: "Supervisor",
    4: "Operativo"
};

/** ¿El usuario tiene al menos el rol indicado? */
export const tieneRol = (usuario: Usuario | null, rolMinimo: Rol): boolean =>
    usuario !== null && Number(usuario.id_role) <= rolMinimo;
