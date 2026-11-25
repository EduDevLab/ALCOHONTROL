import { BeerBottle, Cigarette, Package } from '@phosphor-icons/react';

interface CategoryIconProps {
  categoria: string;
  size?: number;
}

/**
 * Ícono representativo por categoría de producto (Cervezas, Sabritas/Botanas, Cigarros).
 */
export function CategoryIcon({ categoria, size = 18 }: CategoryIconProps) {
  const cat = categoria.trim().toLowerCase();

  if (/cerveza|bebida|licor|alcohol|vino/.test(cat)) {
    return <BeerBottle size={size} weight="duotone" />;
  }

  if (/cigarro|tabaco/.test(cat)) {
    return <Cigarette size={size} weight="duotone" />;
  }

  if (/sabrita|botana|papita|snack|fritura/.test(cat)) {
    // Bolsa de papitas estilizada con detalle duotone acorde a Phosphor (1.75px stroke)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M6.5 4.5C8.5 3.8 15.5 3.8 17.5 4.5L18.5 7.5C17.8 10 17.8 14 18.5 16.5L17.5 19.5C15.5 20.2 8.5 20.2 6.5 19.5L5.5 16.5C6.2 14 6.2 10 5.5 7.5L6.5 4.5Z"
          fill="currentColor"
          fillOpacity="0.16"
        />
        <path d="M7 7.5H17" />
        <path d="M7 16.5H17" />
        <ellipse cx="12" cy="12" rx="2.75" ry="2" transform="rotate(-18 12 12)" />
      </svg>
    );
  }

  return <Package size={size} weight="duotone" />;
}
