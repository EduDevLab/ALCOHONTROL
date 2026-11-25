import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import type { ReporteProducto, ZonaCroquis } from '../../types/alcohontrol.ts';
import type { ZoneResizeHandle } from './croquisGeometry.ts';

interface CroquisZoneItemProps {
  zona: ZonaCroquis;
  index: number;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  isEditing: boolean;
  isInteracting: boolean;
  matchSearch: boolean;
  productosZona: ReporteProducto[];
  onSelect: (id: string) => void;
  onStartDrag: (zona: ZonaCroquis, e: ReactPointerEvent<HTMLDivElement>) => void;
  onStartResize: (zona: ZonaCroquis, handle: ZoneResizeHandle, e: ReactPointerEvent<HTMLDivElement>) => void;
}

const EDGE_HANDLES: Array<{ handle: ZoneResizeHandle; className: string }> = [
  { handle: 'n', className: 'croquis-zone-handle croquis-zone-handle-n' },
  { handle: 's', className: 'croquis-zone-handle croquis-zone-handle-s' },
  { handle: 'e', className: 'croquis-zone-handle croquis-zone-handle-e' },
  { handle: 'w', className: 'croquis-zone-handle croquis-zone-handle-w' },
];

const CORNER_HANDLES: Array<{ handle: ZoneResizeHandle; className: string; label: string }> = [
  { handle: 'nw', className: 'croquis-zone-handle croquis-zone-handle-corner croquis-zone-handle-nw', label: 'Reescalar esquina superior izquierda' },
  { handle: 'ne', className: 'croquis-zone-handle croquis-zone-handle-corner croquis-zone-handle-ne', label: 'Reescalar esquina superior derecha' },
  { handle: 'sw', className: 'croquis-zone-handle croquis-zone-handle-corner croquis-zone-handle-sw', label: 'Reescalar esquina inferior izquierda' },
  { handle: 'se', className: 'croquis-zone-handle croquis-zone-handle-corner croquis-zone-handle-se', label: 'Reescalar esquina inferior derecha' },
];

export function CroquisZoneItem({
  zona,
  index,
  canvasWidth,
  canvasHeight,
  isSelected,
  isEditing,
  isInteracting,
  matchSearch,
  productosZona,
  onSelect,
  onStartDrag,
  onStartResize,
}: CroquisZoneItemProps) {
  const agotados = productosZona.filter((p) => p.Existencias === 0).length;
  const bajos = productosZona.filter((p) => p.Existencias > 0 && p.Existencias <= 30).length;

  const classNames = [
    'croquis-zone',
    isSelected ? 'is-selected' : '',
    matchSearch ? 'is-search-match' : '',
    isInteracting ? 'is-interacting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      data-zone-id={zona.id}
      className={classNames}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.22,
        delay: Math.min(index * 0.03, 0.2),
        ease: [0.22, 1, 0.36, 1],
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onSelect(zona.id);
        if (isEditing) {
          onStartDrag(zona, e);
        }
      }}
      style={{
        left: `${(zona.x / canvasWidth) * 100}%`,
        top: `${(zona.y / canvasHeight) * 100}%`,
        width: `${(zona.width / canvasWidth) * 100}%`,
        height: `${(zona.height / canvasHeight) * 100}%`,
        cursor: isEditing ? (isInteracting ? 'grabbing' : 'grab') : 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {zona.nombre}
        </span>
        {agotados > 0 ? (
          <span className="badge badge-danger num-tabular">{agotados} agot.</span>
        ) : bajos > 0 ? (
          <span className="badge badge-warn num-tabular">{bajos} bajo</span>
        ) : (
          <span className="badge badge-ok num-tabular">{productosZona.length}</span>
        )}
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {productosZona.length === 0
          ? 'Sin productos asignados'
          : productosZona
              .slice(0, 3)
              .map((p) => `${p.Producto} (${p.Existencias})`)
              .join(' · ')}
      </div>

      {isEditing && (
        <>
          {EDGE_HANDLES.map(({ handle, className }) => (
            <div
              key={handle}
              data-zone-handle={handle}
              className={className}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                onSelect(zona.id);
                onStartResize(zona, handle, e);
              }}
            />
          ))}
          {CORNER_HANDLES.map(({ handle, className, label }) => (
            <div
              key={handle}
              role="separator"
              aria-label={label}
              data-zone-handle={handle}
              className={className}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                onSelect(zona.id);
                onStartResize(zona, handle, e);
              }}
            />
          ))}
        </>
      )}

      {isInteracting && (
        <span className="croquis-dim-badge" data-testid={`zone-dim-${zona.id}`}>
          {zona.width} × {zona.height}
        </span>
      )}
    </motion.div>
  );
}
