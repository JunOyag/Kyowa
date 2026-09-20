import React, { useState, useRef, useCallback, useEffect } from 'react';

type ImageCompareModalProps = {
  beforeUrl: string;
  afterUrl: string;
  onClose: () => void;
};

const ZOOM_STEP = 0.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const GAP_PX = 24; // doit correspondre à --space-2 utilisé dans le CSS

type Dims = { width: number; height: number };

const ImageCompareModal = ({ beforeUrl, afterUrl, onClose }: ImageCompareModalProps) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [orientation, setOrientation] = useState<'row' | 'column'>('row');
  const [beforeDims, setBeforeDims] = useState<Dims | null>(null);
  const [afterDims, setAfterDims] = useState<Dims | null>(null);
  const [fitted, setFitted] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleBeforeLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setBeforeDims({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleAfterLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setAfterDims({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Une fois les deux images chargées : choisit l'orientation (côte à
  // côte pour des images "hautes", empilées pour des images "larges") et
  // calcule un zoom initial qui fait tenir l'ensemble dans la fenêtre.
  useEffect(() => {
    if ((!beforeDims) || (!afterDims) || fitted || (!viewportRef.current)) {
      return;
    }

    const isPortrait = beforeDims.width < beforeDims.height;
    const nextOrientation: 'row' | 'column' = isPortrait ? 'row' : 'column';
    setOrientation(nextOrientation);

    const combinedWidth = nextOrientation === 'row'
      ? beforeDims.width + afterDims.width + GAP_PX
      : Math.max(beforeDims.width, afterDims.width);
    const combinedHeight = nextOrientation === 'row'
      ? Math.max(beforeDims.height, afterDims.height)
      : beforeDims.height + afterDims.height + GAP_PX;

    const viewport = viewportRef.current;
    const availableWidth = viewport.clientWidth * 0.94;
    const availableHeight = viewport.clientHeight * 0.94;

    const fitScale = Math.min(availableWidth / combinedWidth, availableHeight / combinedHeight);
    setScale(fitScale);
    setPan({ x: 0, y: 0 });
    setFitted(true);
  }, [beforeDims, afterDims, fitted]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta * s)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const stopDragging = () => {
    dragging.current = false;
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setFitted(false); // redéclenche le calcul de l'ajustement par défaut
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="inspector-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Image comparison"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inspector-toolbar">
          <span className="inspector-hint">Scroll to zoom, click and drag to pan.</span>
          <div className="inspector-toolbar-actions">
            <button type="button" className="btn-secondary" onClick={resetView}>Reset view</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
        <div
          className="inspector-viewport"
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
        >
          <div
            className={`inspector-canvas inspector-canvas--${orientation}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          >
            <figure className="inspector-figure">
              <img src={beforeUrl} alt="Original" onLoad={handleBeforeLoad} draggable={false} />
              <figcaption>Original</figcaption>
            </figure>
            <figure className="inspector-figure">
              <img src={afterUrl} alt="Encoded" onLoad={handleAfterLoad} draggable={false} />
              <figcaption>Encoded</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCompareModal;