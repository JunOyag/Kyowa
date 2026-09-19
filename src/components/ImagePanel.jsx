import React, { useState } from 'react';
import { FaFileImage, FaSyncAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';

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
      toast.error("This image format isn't supported.", { toastId: 'imagepanel-mime-error' });
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
    event.target.value = '';
  }

  function handleDragOver(event) {
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
      toast.error(
        "Couldn't read the dropped image. Try dragging it into a separate Kyowa tab, or use \"Choose an image\" instead.",
        { toastId: 'imagepanel-drop-error' }
      );
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