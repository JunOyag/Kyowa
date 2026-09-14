import React, { useState } from 'react';
import { FaUpload, FaDownload, FaEye, FaTrash, FaTrashRestore, FaCheck, FaLock, FaLockOpen, FaEdit, FaPlusCircle, FaTimes, FaStar } from 'react-icons/fa';
import { Password } from 'primereact/password';
import ItemData from '../model/component/ItemData.ts';
import UiUtils from '../util/UiUtils.ts';

let nbTrashItems = 0;

const EditableList = ({ listUpdate, list, onTryDecodeItem }) => {
  const [items, setItems] = useState<ItemData[]>(list);
  const [editableIndex, setEditableIndex] = useState(null);
  const [editingContentIndex, setEditingContentIndex] = useState(null);
  const [textEditorValue, setTextEditorValue] = useState<string>("");


  const replaceItems = (newItems: ItemData[]) => {
    setItems(newItems);
  }

  const updateItems = (newItems: ItemData[]) => {
    setItems(newItems);
    listUpdate(newItems, replaceItems);
  }

  listUpdate(items, replaceItems);


  const handleNameClick = (index) => {
    setEditableIndex(index);
  };

  const handleNameChange = (index, value) => {
    let newItems = [...items];
    newItems[index].name = value;
    newItems[index].flagNameEdited = true;
    setItems(newItems);
    updateItems(newItems);
  };

  const handleNameBlur = () => {
    setEditableIndex(null);
  };

  const handleAddItem = () => {
    let newItem = new ItemData();
    let newItems = [...items, newItem];
    updateItems(newItems);
  };

  const handleDeleteItem = (index) => {
    const item = items[index];

    item.flagDelete = !item.flagDelete;
    nbTrashItems += item.flagDelete ? 1 : -1;
    let newItems = [...items];
    updateItems(newItems);
  };

  const handleEmptyTrash = () => {
    let lstItemsToDelete = items.filter((it) => it.flagDelete === true);
    if (lstItemsToDelete.length > 0) {
      let confirmDelete = window.confirm("Are you sure you want to permanently delete these " + lstItemsToDelete.length + " item(s)?");

      if (confirmDelete) {
        let lstUids = lstItemsToDelete.map((it) => it.uid);
        updateItems(items.filter((it) => !lstUids.includes(it.uid)));
        nbTrashItems = 0;
      }
      setEditingContentIndex(null);
    }
  };

  const handleUpload = (index, event) => {
    const item = items[index];
    if ((item.isText()) && (item.hasDecodedData())) {
      const confirmOverride = window.confirm("Uploading a new file will delete the existing note. Continue?");
      if (!confirmOverride) return;
    }

    const file: File = event.target.files[0];
    if (file) {
      const newItems = [...items];
      const item = newItems[index];

      item.name = file.name;
      item.contentType = file.type;
      const reader = new FileReader();

      reader.onload = function (e) {
        const arrayBuffer = e.target?.result;
        const uint8Array = new Uint8Array(arrayBuffer as ArrayBufferLike);
        item.decodedData = uint8Array;
        updateItems(newItems);
      };

      reader.readAsArrayBuffer(file);
    }
  };

  const handleDownload = (item) => {
    if (item.hasDecodedData()) {
      const blob = new Blob([item.decodedData], { type: item.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      alert('No file or content to download.');
    }
  };

  const handlePreview = (item, index) => {

    // if ((items.length > 1) && (index > 0)) {
    //   let decoded0 = items[index-1].decodedData;
    //   let decoded1 = items[index].decodedData;

    //   if ((decoded0 === null) || (decoded1 === null)) {
    //     alert("null data");
    //     return;
    //   }
    //   if (decoded0.length !== decoded1.length) {
    //     alert("len diff");
    //     return;
    //   }
    //   for (let i = 0; i < decoded0.length; i++) {
    //     if (decoded0[i] !== decoded1[i]) {
    //       console.log("Diff @" + i + " : data0 = " + decoded0[i] + " ; data1 = " + decoded1[i]);
    //     }
    //   }
    // }
    
    if (item.decodedData !== null) {
      const blob = new Blob([item.decodedData], { type: item.contentType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } else {
      alert('No content to preview.');
    }
  };

  const handleEditContent = (index) => {
    const item = items[index];

    if (!item.isContentEditable()) {
      return;
    }

    if (item.decodedData !== null) {
      let decoder = new TextDecoder();
      let s = decoder.decode(item.decodedData);
      setTextEditorValue(s);
    } else {
      setTextEditorValue("");
    }
    setEditingContentIndex(index);
  };

  const handleSaveContent = () => {
    if (editingContentIndex === null) return;
    const item = items[editingContentIndex];

    const encoder = new TextEncoder();
    item.decodedData = encoder.encode(textEditorValue);

    item.contentType = 'text/plain';
    setEditingContentIndex(null);
    setTextEditorValue('');
    updateItems(items);
  };


  const getItemName = (item) => {
    let s = item.name;

    if (s.length > 20) {
      return s.substring(0, 20) + "...";
    }

    return s;
  }

  
  const getItemLabel = (item) => {
    let displaySize = !item.isDecoded() || !item.isText();
    let hasContent = item.isContentEditable();

    if (!displaySize && !hasContent)
      return 'No content';

    if (displaySize) {
      let size = 0;
      if (item.hasEncodedData()) {
        size = item.encodedData.length || item.decodedData.size;
      }
      if (item.hasDecodedData()) {
        size = item.decodedData.length || item.decodedData.size;
      }
      return UiUtils.formatFileSize(size);
    }

    if (item.decodedData === null) {
      return "";
    }

    let decoder = new TextDecoder();
    let s = decoder.decode(item.decodedData);

    if (s.length > 10) {
      return s.substring(0, 10) + "...";
    }

    return s;
  }

  const handlePassChange = async (index, value) => {
    const item = items[index];
    item.pass = value;

    if ((!item.hasDecodedData()) && (!item.flagNew)) {
      await onTryDecodeItem(item);
    } else {
      const newItems = [...items];
      setItems(newItems);
    }

  }



  return (
    <div style={{ paddingTop: "1rem" }}>
      {/* <h3><FaArrowDown/><FaArrowDown/><FaArrowDown/></h3> */}
      <button onClick={handleAddItem} style={{ marginBottom: '10px' }} title="Add new item">
        <FaPlusCircle />
      </button>
      <div className='flexv' style={{ width: '100%' }}>
        {items.map((item, index) => (
          <div key={index} style={{ width: '100%', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', borderRadius:'10px' }} className={(item.flagDelete === true) ? 'flex trTrash' : 'flex trNorm'}>
            <div className={item.flagNew ? 'itemNew' : 'itemExisting'} style={{ flex: 1, marginRight: '10px', marginBottom: '10px' }}>
              <FaStar title={item.flagNew ? "New item" : "Existing item"} />
            </div>
            <div className={!item.isDecoded() ? 'itemEncrypted' : 'itemDecrypted'} style={{ flex: 1, marginRight: '10px', marginBottom: '10px' }}>
              {(!item.isDecoded()) ? <FaLock title="Encrypted" /> : <FaLockOpen title="Decrypted" />}
            </div>
            <div style={{ flex: '5 0 auto', marginRight: '10px', marginBottom: '10px' }}>
              {(editableIndex === index) && (item.isDecoded()) ? (
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  onBlur={handleNameBlur}
                  autoFocus
                />
              ) : (item.isDecoded()) ? (
                <span
                  onClick={() => handleNameClick(index)}
                  style={{ cursor: 'pointer', textDecoration: 'underline', verticalAlign: 'middle' }}
                  title={item.name}
                >
                  {getItemName(item)}
                </span>
              ) : (
                <span
                  className='encryptedName'
                >
                  Encrypted
                </span>
              )
              }
            </div>
            <div style={{ flex: '5 0 auto', color: 'grey', marginRight: '10px', marginBottom: '10px' }}>
              {getItemLabel(item)}
            </div>


            <div style={{ display: 'inline-flex', gap: '10px', verticalAlign: 'middle', marginRight: '10px', marginBottom: '10px' }}>
              <button disabled={!item.isDecoded()}
                onClick={() => document.getElementById("itemUpload" + index)?.click()}
                title="Attach file">
                <FaUpload />
                <input id={"itemUpload" + index}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(event) => handleUpload(index, event)}
                />
              </button>
              <button onClick={() => handleDownload(item)} title="Download" disabled={!item.hasDecodedData()}>
                <FaDownload />
              </button>
              <button onClick={() => handlePreview(item, index)} title="Preview" disabled={!item.isPreviewable()}>
                <FaEye />
              </button>

              <button onClick={() => handleEditContent(index)} title="Edit Content" disabled={!item.isContentEditable()}>
                <FaEdit />
              </button>

              {item.flagDelete ? (
                <button onClick={() => handleDeleteItem(index)} title="Restore">
                  <FaTrashRestore />
                </button>
              ) : (
                <button onClick={() => handleDeleteItem(index)} title="Put in trash">
                  <FaTrash />
                </button>
              )
              }
            </div>
            <div style={{ flex: '1 0 auto' }}>
              <Password value={item.pass} onChange={(e) => handlePassChange(index, e.target.value)} toggleMask feedback={false} />
            </div>

          </div>

        ))}
      </div>

      {editingContentIndex !== null && (
        <div style={{ marginBottom: '15px' }}>
          <h4>Editing Content of <i>{items[editingContentIndex].name}</i></h4>
          <textarea
            value={textEditorValue}
            onChange={(e) => setTextEditorValue(e.target.value)}
            rows={10}
            cols={30}
          />
          <div>
            <button onClick={handleSaveContent}><FaCheck /></button>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => setEditingContentIndex(null)}><FaTimes /></button>
          </div>
        </div>
      )}
      {(items.length > 0) && (
        <div>
          <button onClick={handleEmptyTrash} disabled={nbTrashItems === 0} title='Empty trash'>
            <i className="pi pi-trash" style={{ fontSize: '2rem' }}></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default EditableList;
