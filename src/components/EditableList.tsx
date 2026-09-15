import React, { useState, useRef, useEffect } from 'react';
import { FaUpload, FaDownload, FaEye, FaTrash, FaTrashRestore, FaEdit, FaPlusCircle } from 'react-icons/fa';
import { Password } from 'primereact/password';
import ItemData from '../model/component/ItemData.ts';
import UiUtils from '../util/UiUtils.ts';

let nbTrashItems = 0;

type SearchMatch = { itemIndex: number; start: number };

const EditableList = ({ listUpdate, list, onTryDecodeItem }) => {
  const [items, setItems] = useState<ItemData[]>(list);
  const [editableIndex, setEditableIndex] = useState(null);
  const [editingContentIndex, setEditingContentIndex] = useState(null);
  const [textEditorValue, setTextEditorValue] = useState<string>("");
  const [bulkPasswords, setBulkPasswords] = useState<string>("");
  const [isTryingBulk, setIsTryingBulk] = useState<boolean>(false);
  const [bulkResultMsg, setBulkResultMsg] = useState<string>("");

  // --- Search state ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchScopeItemIndex, setSearchScopeItemIndex] = useState<number | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [hasNavigated, setHasNavigated] = useState<boolean>(false);
  const [pendingCursorPos, setPendingCursorPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


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

  /**
   * Essaie chaque mot de passe candidat contre tous les fichiers encore
   * chiffrés, en réutilisant onTryDecodeItem : celle-ci teste le mot de
   * passe sur tous les items non déchiffrés et ne le recopie dans le champ
   * de l'item concerné que s'il correspond, avant de déchiffrer.
   */
  const handleTryBulkPasswords = async () => {
    const candidates = bulkPasswords
      .split('\n')
      .map((p) => p.trim())
      .filter((p, idx, arr) => (p.length > 0) && (arr.indexOf(p) === idx));

    if (candidates.length === 0) {
      return;
    }

    setIsTryingBulk(true);
    setBulkResultMsg("");

    for (const candidate of candidates) {
      await onTryDecodeItem({ uid: -1, pass: candidate, isDecoded: () => false });
    }

    setIsTryingBulk(false);
    setBulkResultMsg(candidates.length === 1 ? "Tried 1 password." : `Tried ${candidates.length} passwords.`);
  };

  const hasEncryptedItems = items.some((it) => (!it.isDecoded()) && (!it.flagDelete));


  // --- Search logic ---

  /**
   * Texte utilisé pour la recherche pour un item donné : si l'item est
   * actuellement ouvert dans l'éditeur, on cherche dans le texte en cours
   * de modification (non sauvegardé) plutôt que dans decodedData.
   */
  const getItemSearchText = (index: number, item: ItemData): string => {
    if (index === editingContentIndex) {
      return textEditorValue;
    }
    if (item.decodedData !== null) {
      return new TextDecoder().decode(item.decodedData);
    }
    return "";
  };

  const computeMatches = (): SearchMatch[] => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      return [];
    }
    const lowerQuery = query.toLowerCase();

    const candidateIndices: number[] =
      searchScopeItemIndex !== null
        ? [searchScopeItemIndex]
        : items.reduce((acc: number[], it, idx) => {
            if (it.isContentEditable()) {
              acc.push(idx);
            }
            return acc;
          }, []);

    const results: SearchMatch[] = [];

    candidateIndices.forEach((idx) => {
      const item = items[idx];
      if (item === undefined) {
        return;
      }
      const lowerText = getItemSearchText(idx, item).toLowerCase();
      let fromIndex = 0;
      let found = lowerText.indexOf(lowerQuery, fromIndex);
      while (found !== -1) {
        results.push({ itemIndex: idx, start: found });
        fromIndex = found + lowerQuery.length;
        found = lowerText.indexOf(lowerQuery, fromIndex);
      }
    });

    return results;
  };

  const matches = computeMatches();
  const displayIndex = matches.length === 0 ? 0 : Math.min(currentMatchIndex, matches.length - 1);

  /**
   * Ouvre la note visée (si ce n'est pas déjà la note ouverte, sans écraser
   * un texte en cours de modification) puis positionne le curseur au début
   * de l'occurrence, sans sélection.
   */
  const jumpToMatch = (matchIdx: number) => {
    const m = matches[matchIdx];
    if (!m) return;
    const item = items[m.itemIndex];
    if (!item) return;

    if (editingContentIndex !== m.itemIndex) {
      const decoder = new TextDecoder();
      const text = item.decodedData !== null ? decoder.decode(item.decodedData) : "";
      setTextEditorValue(text);
      setEditingContentIndex(m.itemIndex);
    }
    setPendingCursorPos(m.start);
  };

  useEffect(() => {
    if ((pendingCursorPos !== null) && (textareaRef.current !== null)) {
      const pos = Math.min(pendingCursorPos, textareaRef.current.value.length);
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
      setPendingCursorPos(null);
    }
  }, [pendingCursorPos, editingContentIndex, textEditorValue]);

  const handleSearchQueryChange = (value: string) => {
    const wasEmpty = searchQuery.trim().length === 0;
    const isEmptyNow = value.trim().length === 0;

    setSearchQuery(value);

    if (isEmptyNow) {
      setSearchScopeItemIndex(null);
      setCurrentMatchIndex(0);
      setHasNavigated(false);
      return;
    }

    if (wasEmpty) {
      // La recherche démarre : la portée (note ouverte, ou toutes les notes) est figée ici.
      setSearchScopeItemIndex(editingContentIndex);
      setCurrentMatchIndex(0);
      setHasNavigated(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0) {
        setHasNavigated(true);
        jumpToMatch(displayIndex);
      }
    }
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    if (!hasNavigated) {
      setHasNavigated(true);
      jumpToMatch(displayIndex);
      return;
    }
    const next = (displayIndex + 1) % matches.length;
    setCurrentMatchIndex(next);
    jumpToMatch(next);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    if (!hasNavigated) {
      setHasNavigated(true);
      jumpToMatch(displayIndex);
      return;
    }
    const prev = (displayIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prev);
    jumpToMatch(prev);
  };

  const hasTextNotes = items.some((it) => it.isContentEditable());


  return (
    <div style={{ paddingTop: "1rem" }}>
      <div className="list-toolbar">
        <button type="button" className="btn-secondary" onClick={handleAddItem}>
          <FaPlusCircle /> Add file
        </button>
        {(items.length > 0) && (
          <button
            type="button"
            className="btn-secondary btn-secondary--danger"
            onClick={handleEmptyTrash}
            disabled={nbTrashItems === 0}
          >
            <FaTrash /> Empty trash
          </button>
        )}
      </div>

      {hasEncryptedItems && (
        <div className="password-try-panel">
          <label htmlFor="bulkPasswords" className="password-try-label">Try passwords</label>
          <p className="password-try-hint">
            One per line. A matching password is copied into its file and used to decrypt it.
          </p>
          <textarea
            id="bulkPasswords"
            className="password-try-input"
            rows={3}
            value={bulkPasswords}
            onChange={(e) => setBulkPasswords(e.target.value)}
            placeholder={"password one\npassword two"}
          />
          <div className="password-try-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTryBulkPasswords}
              disabled={isTryingBulk || bulkPasswords.trim().length === 0}
            >
              {isTryingBulk && <i className="pi pi-spin pi-cog" style={{ marginRight: '0.4rem' }}></i>}
              Try passwords
            </button>
            {bulkResultMsg && <span className="password-try-result">{bulkResultMsg}</span>}
          </div>
        </div>
      )}

      {hasTextNotes && (
        <div className="search-panel">
          <label htmlFor="noteSearch" className="search-panel-label">Search notes</label>
          <div className="search-panel-row">
            <input
              id="noteSearch"
              type="text"
              className="search-panel-input"
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search text in notes..."
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => handleSearchQueryChange('')}
                aria-label="Clear search"
                title="Clear search"
              >
                &times;
              </button>
            )}
            <div className="search-nav">
              <button
                type="button"
                className="search-nav-btn"
                onClick={handlePrevMatch}
                disabled={matches.length === 0}
                aria-label="Previous occurrence"
                title="Previous occurrence"
              >
                «
              </button>
              <span className="search-nav-count data">
                {matches.length > 0 ? `${displayIndex + 1} / ${matches.length}` : '0 / 0'}
              </span>
              <button
                type="button"
                className="search-nav-btn"
                onClick={handleNextMatch}
                disabled={matches.length === 0}
                aria-label="Next occurrence"
                title="Next occurrence"
              >
                »
              </button>
            </div>
          </div>
          {searchScopeItemIndex !== null && (
            <p className="search-panel-hint">Searching only in the open note.</p>
          )}
        </div>
      )}

      {items.length === 0 && (
        <p className="empty-state">No hidden files yet.</p>
      )}

      <div className="file-list">
        {items.map((item, index) => (
          <div key={index} className={item.flagDelete ? 'file-row file-row--trash' : 'file-row'}>

            <div className="file-row-main">
              <div className="file-badges">
                {item.flagDelete ? (
                  <span className="badge badge--trash">In trash</span>
                ) : (
                  <>
                    {item.flagNew && <span className="badge badge--new">New</span>}
                    {!item.isDecoded() && <span className="badge badge--locked">Encrypted</span>}
                  </>
                )}
              </div>

              <div className="file-name">
                {(editableIndex === index) && (item.isDecoded()) ? (
                  <input
                    type="text"
                    className="file-name-input"
                    value={item.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    onBlur={handleNameBlur}
                    autoFocus
                  />
                ) : (item.isDecoded()) ? (
                  <button
                    type="button"
                    className="file-name-btn"
                    onClick={() => handleNameClick(index)}
                    title={item.name}
                  >
                    {getItemName(item)}
                  </button>
                ) : (
                  <span className="file-name-locked">Encrypted item</span>
                )}
                <span className="file-meta data">{getItemLabel(item)}</span>
              </div>
            </div>

            <div className="file-row-actions">
              <div className="file-pass">
                <Password
                  value={item.pass}
                  onChange={(e) => handlePassChange(index, e.target.value)}
                  toggleMask
                  feedback={false}
                />
              </div>

              <div className="file-buttons">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={!item.isDecoded()}
                  onClick={() => document.getElementById("itemUpload" + index)?.click()}
                  title="Attach file"
                  aria-label="Attach file"
                >
                  <FaUpload />
                  <input
                    id={"itemUpload" + index}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(event) => handleUpload(index, event)}
                  />
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleDownload(item)}
                  disabled={!item.hasDecodedData()}
                  title="Download"
                  aria-label="Download"
                >
                  <FaDownload />
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handlePreview(item, index)}
                  disabled={!item.isPreviewable()}
                  title="Preview"
                  aria-label="Preview"
                >
                  <FaEye />
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleEditContent(index)}
                  disabled={!item.isContentEditable()}
                  title="Edit content"
                  aria-label="Edit content"
                >
                  <FaEdit />
                </button>

                {item.flagDelete ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn--restore"
                    onClick={() => handleDeleteItem(index)}
                    title="Restore"
                    aria-label="Restore"
                  >
                    <FaTrashRestore />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => handleDeleteItem(index)}
                    title="Move to trash"
                    aria-label="Move to trash"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

      {editingContentIndex !== null && (
        <div className="content-editor">
          <h4 className="content-editor-title">Editing "{items[editingContentIndex].name}"</h4>
          <textarea
            ref={textareaRef}
            value={textEditorValue}
            onChange={(e) => setTextEditorValue(e.target.value)}
            rows={10}
          />
          <div className="content-editor-actions">
            <button type="button" className="btn-secondary" onClick={handleSaveContent}>
              Save changes
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingContentIndex(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableList;