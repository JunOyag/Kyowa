import React, { useState } from 'react';
import { FaFileImage, FaSyncAlt } from 'react-icons/fa';

import CarrierFactoryInstance from '../service/CarrierFactory.ts';


const ImagePanel = ({ callback }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [lastFile, setLastFile] = useState(null);

  const mimeTypes = CarrierFactoryInstance.getAllMimeTypes().join(",");

  function callParent(file) {
    if ((file !== undefined) && (file instanceof File)) {
      callback(file);
    } else if (lastFile != null) {
      callback(lastFile);
    }
  }

  function handleImageChange(event) {
    const file = event.target.files[0];
    if (file) {

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
  }

  return (
    <div className="image-panel">
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