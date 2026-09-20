import React, { useEffect, useRef, useState } from 'react';
import ImageCompareModal from '../model/component/ImageCompareModal.tsx';

type DiffPreviewModalProps = {
  beforeUrl: string;
  afterUrl: string;
  onClose: () => void;
  onSave: () => void;
};

const AMPLIFICATION = 25;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const DiffPreviewModal = ({ beforeUrl, afterUrl, onClose, onSave }: DiffPreviewModalProps) => {
  const [diffUrl, setDiffUrl] = useState<string>('');
  const [inspecting, setInspecting] = useState<boolean>(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const computeDiff = async () => {
      const [imgBefore, imgAfter] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);
      if (cancelledRef.current) return;

      const width = Math.min(imgBefore.naturalWidth, imgAfter.naturalWidth);
      const height = Math.min(imgBefore.naturalHeight, imgAfter.naturalHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(imgBefore, 0, 0, width, height);
      const beforeData = ctx.getImageData(0, 0, width, height);

      ctx.drawImage(imgAfter, 0, 0, width, height);
      const afterData = ctx.getImageData(0, 0, width, height);

      const diffData = ctx.createImageData(width, height);
      for (let i = 0; i < beforeData.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const delta = Math.abs(beforeData.data[i + c] - afterData.data[i + c]) * AMPLIFICATION;
          diffData.data[i + c] = Math.min(255, delta);
        }
        diffData.data[i + 3] = 255;
      }

      ctx.putImageData(diffData, 0, 0);
      if (!cancelledRef.current) {
        setDiffUrl(canvas.toDataURL());
      }
    };

    computeDiff();

    return () => { cancelledRef.current = true; };
  }, [beforeUrl, afterUrl]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="diff-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Before / after comparison"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="diff-panel-title">Before / after comparison</h3>
        <p className="diff-panel-hint">
          Click an image to inspect it up close. The third image amplifies the pixel
          differences ({AMPLIFICATION}×) so the hidden data's footprint becomes visible —
          it is otherwise invisible to the naked eye.
        </p>

        <div className="diff-grid">
          <figure className="diff-figure" onClick={() => setInspecting(true)}>
            <img src={beforeUrl} alt="Original" />
            <figcaption>Original</figcaption>
          </figure>
          <figure className="diff-figure" onClick={() => setInspecting(true)}>
            <img src={afterUrl} alt="Encoded" />
            <figcaption>Encoded</figcaption>
          </figure>
          <figure className="diff-figure diff-figure--amplified">
            {diffUrl ? <img src={diffUrl} alt="Amplified difference" /> : <span className="diff-loading">Computing...</span>}
            <figcaption>Amplified difference</figcaption>
          </figure>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn-primary" onClick={onSave}>Save this image</button>
        </div>
      </div>

      {inspecting && (
        <ImageCompareModal
          beforeUrl={beforeUrl}
          afterUrl={afterUrl}
          onClose={() => setInspecting(false)}
        />
      )}
    </div>
  );
};

export default DiffPreviewModal;