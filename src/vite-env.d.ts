/// <reference types="vite/client" />

// Tipado de las variables del .env. Sin esto, TypeScript no sabe que
// import.meta.env.VITE_API_URL existe.
interface ImportMetaEnv {
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
