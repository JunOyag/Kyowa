import React, { useState } from 'react';
import { FaFileImage, FaSyncAlt } from 'react-icons/fa';

import CarrierFactoryInstance from '../service/CarrierFactory.ts';


const ImagePanel = ({ callback }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const mimeTypes = CarrierFactoryInstance.getAllMimeTypes().join(",");

  function callParent(file) {
    if ((file !== undefined) && (file instanceof File)) {
      callback(file);
    } else if (lastFile != null) {
      callback(lastFile);
    }
  }

  function processFile(file) {
    if (!file) {
      return;
    }

    if (CarrierFactoryInstance.getAllMimeTypes().filter((e) => file.type === e).length === 0) {
      alert("Image mime type is not valid.");
      return;
    }

    setLastFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    callParent(file);
  }

  function handleImageChange(event) {
    const file = event.target.files[0];
    processFile(file);
    // Permet de resélectionner le même fichier (input file ne redéclenche
    // pas onChange si la valeur ne change pas).
    event.target.value = '';
  }

  function handleDragOver(event) {
    // Indispensable : sans ça, le navigateur refuse le drop par défaut.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDraggingOver(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDraggingOver(false);

    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) {
      // L'image glissée n'a pas pu être matérialisée en fichier par le
      // navigateur (cas rare : certains navigateurs/certaines images
      // cross-origin très restreintes). On informe plutôt que d'échouer
      // silencieusement.
      alert("Couldn't read the dropped image. Try dragging it into a separate Kyowa tab, or save it locally and use \"Choose an image\" instead.");
      return;
    }

    processFile(file);
  }

  return (
    <div className="image-panel">
      <div
        className={isDraggingOver ? 'image-dropzone image-dropzone--active' : 'image-dropzone'}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label className="btn-secondary image-choose-btn" htmlFor="imageUpload">
          <FaFileImage />
          {previewUrl ? 'Choose a different image' : 'Choose an image'}
          <input
            type="file"
            id="imageUpload"
            accept={mimeTypes}
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
        </label>
        <p className="image-dropzone-hint">or drag an image here from another tab</p>
      </div>

      {previewUrl && (
        <div className="image-preview">
          <img
            src={previewUrl}
            alt="Selected"
            className="image-preview-thumb"
          />
          <div className="image-preview-info">
            <span className="image-preview-name">{lastFile && lastFile.name}</span>
            <button type="button" className="icon-btn" onClick={callParent} title="Reload" aria-label="Reload image">
              <FaSyncAlt />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePanel;