import React, { useState, useRef, useEffect } from 'react';
import {
  FaUpload, FaDownload, FaEye, FaTrash, FaTrashRestore, FaEdit, FaPlusCircle,
  FaChevronDown, FaChevronUp, FaGripVertical
} from 'react-icons/fa';
import { Password } from 'primereact/password';
import { toast } from 'react-toastify';
import ItemData from '../model/component/ItemData.ts';
import UiUtils from '../util/UiUtils.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

let nbTrashItems = 0;

type SearchMatch = { itemIndex: number; start: number };
type PendingSelection = { start: number; end: number };
type ConfirmRequest = { message: string; danger: boolean; resolve: (v: boolean) => void };

function computeScrollTopForIndex(textarea: HTMLTextAreaElement, index: number): number {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const propsToCopy = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'wordSpacing'
  ];
  propsToCopy.forEach((prop) => {
    (mirror.style as any)[prop] = (style as any)[prop];
  });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.height = 'auto';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  document.body.appendChild(mirror);

  const textBefore = textarea.value.substring(0, index);
  mirror.textContent = textBefore;
  const marker = document.createElement('span');
  marker.textContent = textarea.value.substring(index, index + 1) || '.';
  mirror.appendChild(marker);

  const caretTop = marker.offsetTop;
  document.body.removeChild(mirror);

  const target = caretTop - (textarea.clientHeight / 2);
  const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
  return Math.max(0, Math.min(target, maxScroll));
}


const EditableList = ({ listUpdate, list, onTryDecodeItem }) => {
  const [items, setItems] = useState<ItemData[]>(list);
  const [editableIndex, setEditableIndex] = useState(null);
  const [editingContentIndex, setEditingContentIndex] = useState(null);
  const [textEditorValue, setTextEditorValue] = useState<string>("");
  const [bulkPasswords, setBulkPasswords] = useState<string>("");
  const [isTryingBulk, setIsTryingBulk] = useState<boolean>(false);
  const [bulkResultMsg, setBulkResultMsg] = useState<string>("");

  const [collapsedUids, setCollapsedUids] = useState<Set<number>>(new Set());
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchScopeItemIndex, setSearchScopeItemIndex] = useState<number | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [hasNavigated, setHasNavigated] = useState<boolean>(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);


  /**
   * Point d'entrée unique pour purger collapsedUids/selectedUids : appelé
   * systématiquement par updateItems() (modifications locales) ET
   * replaceItems() (données repoussées par App.tsx), pour que la barre de
   * multi-sélection se referme quelle que soit la façon dont des éléments
   * disparaissent ou passent à la corbeille (individuelle, groupée, vidage
   * de corbeille...).
   */
  const pruneSelectionAndCollapse = (newItems: ItemData[]) => {
    const stillPresentUids = new Set(newItems.map((it) => it.uid));

    setCollapsedUids((prev) => {
      const next = new Set<number>();
      prev.forEach((uid) => { if (stillPresentUids.has(uid)) next.add(uid); });
      return next;
    });

    setSelectedUids((prev) => {
      const next = new Set<number>();
      newItems.forEach((it) => {
        if (prev.has(it.uid) && !it.flagDelete) {
          next.add(it.uid);
        }
      });
      return next;
    });
  };

  const replaceItems = (newItems: ItemData[]) => {
    setItems((prevItems) => {
      if (editingContentIndex !== null) {
        const prevItem = prevItems[editingContentIndex];
        const nextItem = newItems[editingContentIndex];
        const stillSameItem = (prevItem !== undefined) && (nextItem !== undefined) && (prevItem.uid === nextItem.uid);
        if (!stillSameItem) {
          setEditingContentIndex(null);
          setTextEditorValue('');
        }
      }

      if (editableIndex !== null) {
        const prevItem = prevItems[editableIndex];
        const nextItem = newItems[editableIndex];
        const stillSameItem = (prevItem !== undefined) && (nextItem !== undefined) && (prevItem.uid === nextItem.uid);
        if (!stillSameItem) {
          setEditableIndex(null);
        }
      }

      return newItems;
    });

    pruneSelectionAndCollapse(newItems);
  }

  const updateItems = (newItems: ItemData[]) => {
    setItems(newItems);
    pruneSelectionAndCollapse(newItems);
    listUpdate(newItems, replaceItems);
  }

  listUpdate(items, replaceItems);


  // --- Confirmation modale (remplace window.confirm) ---

  const askConfirm = (message: string, danger: boolean = false): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmRequest({ message, danger, resolve });
    });
  };

  const closeConfirm = (result: boolean) => {
    confirmRequest?.resolve(result);
    setConfirmRequest(null);
  };


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

  const handleEmptyTrash = async () => {
    let lstItemsToDelete = items.filter((it) => it.flagDelete === true);
    if (lstItemsToDelete.length > 0) {
      const confirmed = await askConfirm(
        `Permanently delete these ${lstItemsToDelete.length} item(s)? This can't be undone.`,
        true
      );

      if (confirmed) {
        let lstUids = lstItemsToDelete.map((it) => it.uid);
        updateItems(items.filter((it) => !lstUids.includes(it.uid)));
        nbTrashItems = 0;
      }
      setEditingContentIndex(null);
    }
  };

  const processUploadedFile = async (index: number, file: File) => {
    const item = items[index];
    if (!item.isDecoded()) {
      return;
    }
    if ((item.isText()) && (item.hasDecodedData())) {
      const confirmed = await askConfirm("Uploading a new file will delete the existing note. Continue?", true);
      if (!confirmed) return;
    }

    const newItems = [...items];
    const it = newItems[index];

    it.name = file.name;
    it.contentType = file.type;
    const reader = new FileReader();

    reader.onload = function (e) {
      const arrayBuffer = e.target?.result;
      const uint8Array = new Uint8Array(arrayBuffer as ArrayBufferLike);
      it.decodedData = uint8Array;
      updateItems(newItems);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async (index, event) => {
    const file: File = event.target.files[0];
    if (file) {
      await processUploadedFile(index, file);
    }
    event.target.value = '';
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
      toast.error('No file or content to download.', { toastId: 'editablelist-download-error' });
    }
  };

  const handlePreview = (item, index) => {
    if (item.decodedData !== null) {
      const blob = new Blob([item.decodedData], { type: item.contentType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } else {
      toast.error('No content to preview.', { toastId: 'editablelist-preview-error' });
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


  // --- Repli / dépli ---

  const toggleCollapse = (uid: number) => {
    setCollapsedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };


  // --- Sélection multiple ---

  const toggleSelect = (uid: number) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUids.size === items.length) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(items.map((it) => it.uid)));
    }
  };

  const handleBulkDownload = () => {
    const targets = items.filter((it) => selectedUids.has(it.uid) && it.hasDecodedData());
    if (targets.length === 0) {
      toast.warning("None of the selected items can be downloaded yet.", { toastId: 'bulk-download-empty' });
      return;
    }
    targets.forEach((item) => handleDownload(item));
    toast.success(`Downloaded ${targets.length} file(s).`, { toastId: 'bulk-download-success' });
  };

  const handleBulkTrash = async () => {
    const targets = items.filter((it) => selectedUids.has(it.uid) && !it.flagDelete);
    if (targets.length === 0) return;

    const confirmed = await askConfirm(`Move ${targets.length} item(s) to trash?`, true);
    if (!confirmed) return;

    const targetUids = new Set(targets.map((it) => it.uid));
    const newItems = items.map((it) => {
      if (targetUids.has(it.uid)) {
        it.flagDelete = true;
        nbTrashItems += 1;
      }
      return it;
    });
    // La sélection se nettoie automatiquement (pruneSelectionAndCollapse,
    // appelé par updateItems) puisque ces items sont désormais flagDelete.
    updateItems(newItems);
  };


  // --- Glisser-déposer : attacher un fichier externe / réordonner ---

  const handleDragStart = (item: ItemData) => (event: React.DragEvent) => {
    event.dataTransfer.setData('text/x-kyowa-item-uid', String(item.uid));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (index: number, item: ItemData) => (event: React.DragEvent) => {
    const isFileDrag = event.dataTransfer.types.includes('Files');
    if (isFileDrag && !item.isDecoded()) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = isFileDrag ? 'copy' : 'move';
    setDragOverIndex(index);
  };

  const handleRowDragLeave = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    setDragOverIndex((cur) => (cur === index ? null : cur));
  };

  const reorderItems = (draggedUid: number, targetUid: number) => {
    if (draggedUid === targetUid) return;
    const fromIndex = items.findIndex((it) => it.uid === draggedUid);
    const toIndex = items.findIndex((it) => it.uid === targetUid);
    if (fromIndex === -1 || toIndex === -1) return;
    const newItems = [...items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    updateItems(newItems);
  };

  const handleRowDrop = (index: number, item: ItemData) => async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOverIndex(null);

    if (event.dataTransfer.types.includes('Files')) {
      if (!item.isDecoded()) {
        toast.warning("Decrypt this item first before attaching a file.", { toastId: 'row-drop-locked' });
        return;
      }
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) {
        toast.error("Couldn't read the dropped file.", { toastId: 'row-drop-error' });
        return;
      }
      await processUploadedFile(index, file);
      return;
    }

    const draggedUidRaw = event.dataTransfer.getData('text/x-kyowa-item-uid');
    if (draggedUidRaw === '') return;
    reorderItems(Number(draggedUidRaw), item.uid);
  };


  // --- Recherche ---

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
  const matchLength = searchQuery.trim().length;

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

    setCollapsedUids(new Set(items.filter((it) => it.uid !== item.uid).map((it) => it.uid)));

    setPendingSelection({ start: m.start, end: m.start + matchLength });
  };

  useEffect(() => {
    if ((pendingSelection !== null) && (textareaRef.current !== null)) {
      const ta = textareaRef.current;
      const maxLen = ta.value.length;
      const start = Math.min(pendingSelection.start, maxLen);
      const end = Math.min(pendingSelection.end, maxLen);

      ta.focus();
      ta.setSelectionRange(start, end);
      ta.scrollTop = computeScrollTopForIndex(ta, start);

      setPendingSelection(null);
    }
  }, [pendingSelection, editingContentIndex, textEditorValue]);

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


  // --- Raccourcis clavier ---

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (e.key.toLowerCase() === 'f') && hasTextNotes) {
        e.preventDefault();
        const el = document.getElementById('noteSearch') as HTMLInputElement | null;
        el?.focus();
        el?.select();
        return;
      }

      if ((editingContentIndex !== null) && (confirmRequest === null)) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setEditingContentIndex(null);
          setTextEditorValue('');
          return;
        }
        if (isCtrlOrCmd && (e.key.toLowerCase() === 's')) {
          e.preventDefault();
          handleSaveContent();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingContentIndex, textEditorValue, hasTextNotes, confirmRequest]);


  return (
    <div style={{ paddingTop: "1rem" }}>
      <div className="list-toolbar">
        <div className="list-toolbar-left">
          <button type="button" className="btn-secondary" onClick={handleAddItem}>
            <FaPlusCircle /> Add file
          </button>
          {(items.length > 0) && (
            <label className="select-all-label">
              <input
                type="checkbox"
                checked={(selectedUids.size > 0) && (selectedUids.size === items.length)}
                onChange={toggleSelectAll}
              />
              Select all
            </label>
          )}
        </div>
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

      {selectedUids.size > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-actions-count">{selectedUids.size} selected</span>
          <button type="button" className="btn-secondary" onClick={handleBulkDownload}>
            <FaDownload /> Download
          </button>
          <button type="button" className="btn-secondary btn-secondary--danger" onClick={handleBulkTrash}>
            <FaTrash /> Move to trash
          </button>
          <button type="button" className="btn-secondary" onClick={() => setSelectedUids(new Set())}>
            Clear selection
          </button>
        </div>
      )}

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
              placeholder="Search text in notes... (Ctrl+F)"
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
        {items.map((item, index) => {
          const isCollapsed = collapsedUids.has(item.uid);
          const rowClasses = [
            'file-row',
            item.flagDelete ? 'file-row--trash' : '',
            dragOverIndex === index ? 'file-row--dragover' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={index}
              className={rowClasses}
              onDragOver={handleRowDragOver(index, item)}
              onDragLeave={handleRowDragLeave(index)}
              onDrop={handleRowDrop(index, item)}
            >

              <div className="file-row-header">
                <button
                  type="button"
                  className="drag-handle"
                  draggable
                  onDragStart={handleDragStart(item)}
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                >
                  <FaGripVertical />
                </button>

                <div className="row-select">
                  <input
                    type="checkbox"
                    className="row-select-checkbox"
                    checked={selectedUids.has(item.uid)}
                    onChange={() => toggleSelect(item.uid)}
                    aria-label={`Select ${item.name}`}
                  />
                </div>

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

                <button
                  type="button"
                  className="icon-btn collapse-btn"
                  onClick={() => toggleCollapse(item.uid)}
                  aria-label={isCollapsed ? 'Expand item' : 'Collapse item'}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                </button>
              </div>

              {!isCollapsed && (
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
              )}

            </div>
          );
        })}
      </div>

      {(editingContentIndex !== null) && (items[editingContentIndex] !== undefined) && (
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
              Save changes <span className="shortcut-hint">Ctrl+S</span>
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingContentIndex(null)}>
              Cancel <span className="shortcut-hint">Esc</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRequest !== null}
        message={confirmRequest?.message ?? ''}
        danger={confirmRequest?.danger ?? false}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
    </div>
  );
};

export default EditableList;