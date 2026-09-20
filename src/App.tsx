import React, { useState } from 'react';

import 'primeicons/primeicons.css';
import { ProgressBar } from 'primereact/progressbar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './App.css';
import Credentials from './model/Credentials.ts';
import ItemData from './model/component/ItemData.ts';
import { DataContainer } from './model/data/DataContainer.ts';
import DataConv from './service/DataConv.ts';
import { CarrierManagerBase } from './service/CarrierManagerBase.ts';
import CarrierFactoryInstance from './service/CarrierFactory.ts';
import PassPanel from './components/PassPanel.jsx';
import ImagePanel from './components/ImagePanel.jsx';
import EditableList from './components/EditableList.tsx';
import ThemeSwitcher from './components/themeSwitcher';
import DiffPreviewModal from './components/DiffPreviewModal.tsx';
import { TaskCancelledError } from './util/Task.ts';

import UiUtils from './util/UiUtils.ts';



let carrierManager: CarrierManagerBase | undefined;

type DiffPreviewState = { beforeUrl: string; afterUrl: string; blob: Blob } | null;

function App() {

  const [fileName, setFileName] = useState<string>("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [credentials, setCredentials] = useState(new Credentials());
  const [status, setStatus] = useState("Open an image file");
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const [listItems, setListItems] = useState<ItemData[]>([]);
  const [storRateCap, setStorRateCap] = useState<number>(0.5);
  const [storTotalCap, setStorTotalCap] = useState<number>(0);
  const [storUsedCap, setStorUsedCap] = useState<number>(0);
  const [diffPreview, setDiffPreview] = useState<DiffPreviewState>(null);


  let cbReplaceItems: CallableFunction; // To send listItems into EditableList
  let imgStorageCapacities: number[] = [0];


  const computeStorRateCap = (used: number, total: number) => {
    if (total === 0) {
      setStorRateCap(0);
    } else {
      setStorRateCap((used / total) * 100);
    }
  }


  const cbListUpdate = (lst: ItemData[], _cbReplaceItems: CallableFunction) => {
    cbReplaceItems = _cbReplaceItems;

    setTimeout(() => {
      setListItems(lst); // Receive listItems from EditableList

      let usedCap = 6 + 4 + 32 + 4; // DataContainer header + Hash + Stop blocks
      // update used capacity
      for (let item of lst) {
        let itemCap = 0;
        if (!item.flagDelete) {
          itemCap += 4; // Block head
          if (item.hasEncodedData()) {
            itemCap = item.encodedData?.length || 0;
          } else {
            let tmpItemCap = 4; // block data header
            tmpItemCap += 1 + item.name.length;
            tmpItemCap += 1 + item.contentType.length;
            tmpItemCap += item.decodedData?.length || 0;

            // 16-bytes AES padding
            tmpItemCap += 15;
            tmpItemCap &= 0xFFFFFFF0;

            itemCap += tmpItemCap;
          }
        }
        usedCap += itemCap;
      }

      setStorUsedCap(usedCap);
      computeStorRateCap(usedCap, storTotalCap);

    }, 100);

  }


  const msg = (str) => {
    setStatus(str);
  }


  const onDecodeSuccess = async (data: DataContainer) => {
    msg("Data found : items updated.");
    toast.success("Hidden data found.", { toastId: 'decode-success' });

    // keep new items
    let newListItems = listItems.filter((item) => (item.flagNew));

    let lstPass = [credentials.getPassMaster()]; // will try with master pass
    lstPass.push(""); // will try with empty pass
    for (let item of listItems) {
      lstPass.push(item.pass); // will try with every single file pass
    }

    // add decoded items
    for (const blk of data.getDataBlocks()) {
      let passOk = "";
      for (let pass of lstPass) {
        await blk.tryDecode(pass);
        if (blk.isDecoded()) {
          passOk = pass;
          break;
        }
      }
      let newItem = DataConv.fromBlockData(blk);
      newItem.pass = passOk;
      newListItems.push(newItem);
    }

    // refresh UI
    setListItems(newListItems);
    if (cbReplaceItems !== undefined) {
      cbReplaceItems(newListItems);
    }

  }

  const onDecodeError = (err) => {
    msg("No data found : items not updated.");
    toast.warning("No hidden data found with this passphrase.", { toastId: 'decode-no-data' });
    console.log("onDecodeError : " + err);
  }

  const onAfterDecode = () => {
    setProgressVisible(false);
  }


  const tryDecode = async (newCred?) => {
    if ((carrierManager === undefined) || (!carrierManager.isFileRead())) {
      return;
    }
    msg("Decoding...");
    setProgressVisible(true);

    let creds = newCred || credentials;

    carrierManager.stop();
    carrierManager = carrierManager.newInstance();

    try {
      const data = await carrierManager.decode(creds, (_progress) => {
        setProgress(_progress);
      });
      await onDecodeSuccess(data);
      onAfterDecode();
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        return;
      }
      onDecodeError(error);
      onAfterDecode();
    }
  }

  const updateImageStorageCapacities = () => {
    let imgStorageTotal = 0;
    if (carrierManager !== undefined) {
      imgStorageCapacities = carrierManager.getLayersCapacity();
      for (let layerCapacity of imgStorageCapacities) {
        imgStorageTotal += layerCapacity;
      }
    } else {
      imgStorageCapacities = [];
    }

    imgStorageTotal = Math.floor(imgStorageTotal / 8); // Bits to Bytes

    setStorTotalCap(imgStorageTotal);
    computeStorRateCap(storUsedCap, imgStorageTotal);
  }


  const onReadSuccess = () => {
    msg("Image read.");
    toast.success("Image loaded.", { toastId: 'read-success' });
    updateImageStorageCapacities();
    tryDecode();
  }

  const onReadError = (err) => {
    msg("Image could not be read : " + err);
    toast.error("Couldn't load the image (" + err + ").", { toastId: 'read-error' });
    console.log("onReadError : " + err);
    setProgressVisible(false);
  }

  const tryRead = async (file) => {

    msg("Reading...");
    setProgressVisible(true);

    console.log("tryRead ");

    if (carrierManager !== undefined) {
      carrierManager.stop();
    }
    carrierManager = CarrierFactoryInstance.getCarrierManager({ type: file.type });

    if (carrierManager === undefined) {
      msg("Image file format not supported.");
      toast.error("This image format isn't supported.", { toastId: 'read-format-error' });
      setProgressVisible(false);
      return;
    }

    try {
      await carrierManager.read(file, (_progress) => {
        setProgress(_progress);
      });
      onReadSuccess();
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        return;
      }
      onReadError(error);
    }
  }


  const closeDiffPreview = () => {
    setDiffPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.beforeUrl);
        URL.revokeObjectURL(prev.afterUrl);
      }
      return null;
    });
  }


  const cbImageInputChanged = (file: File) => {
    closeDiffPreview();
    setFileName(file.name);
    setOriginalFile(file);
    carrierManager = CarrierFactoryInstance.getCarrierManager(file);
    tryRead(file);
  }

  const cbPassMasterChanged = (newCred: Credentials) => {
    if (newCred && (!newCred.equals(credentials))) {
      setCredentials(newCred);
    }

    tryDecode(newCred);
  }


  const tryDecodeItem = async (item: ItemData) => {
    if (item.isDecoded()) {
      return;
    }
    let newPass = item.pass;
    for (let i = 0; i < listItems.length; i++) {
      let itm = listItems[i];
      if (itm.uid === item.uid) {
        itm.pass = newPass;
      }
      if (!itm.hasDecodedData()) {
        let blk = DataConv.toBlockData(itm);
        await blk.tryDecode(newPass);
        if (blk.isDecoded()) {
          itm = DataConv.fromBlockData(blk);
          itm.pass = newPass;
          listItems[i] = itm;
        }
      }
    }

    if (cbReplaceItems !== undefined) {
      let newItems = [...listItems];
      setListItems(newItems);
      cbReplaceItems(newItems);
    }
  }


  const onWriteSuccess = (blob: Blob) => {
    msg("Image saved.");
    toast.success("Image saved.", { toastId: 'write-success' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  const onEncodeError = (err) => {
    msg("Encoding error (" + err + ").");
    toast.error("Encoding error (" + err + ").", { toastId: 'encode-error' });
    setProgressVisible(false);
  }


  /**
   * Encode tous les items puis écrit l'image finale, et retourne le blob
   * obtenu — sans le télécharger. Repart systématiquement d'une lecture
   * fraîche de `originalFile` : encode()/write() modifient les pixels EN
   * PLACE sur l'instance de CarrierManager utilisée, donc réutiliser
   * `carrierManager` (partagé avec le reste de l'app, notamment le
   * décodage) enchaînerait les encodages les uns sur les autres au lieu de
   * toujours repartir de l'image d'origine.
   */
  const runEncodeAndWrite = async (): Promise<Blob> => {
    if (originalFile === null) {
      throw new Error("No image loaded.");
    }

    const freshManager = CarrierFactoryInstance.getCarrierManager({ type: originalFile.type });
    if (freshManager === undefined) {
      throw new Error("Image file format not supported.");
    }
    await freshManager.read(originalFile, () => {});

    let dc = new DataContainer();

    if (listItems !== undefined) {
      for (const item of listItems) {
        if (!item.flagDelete) {
          let newBlk = DataConv.toBlockData(item);
          await newBlk.encode(item.pass);
          dc.addDataBlock(newBlk);
        }
      }
    }

    await freshManager.encode(credentials, dc, (_progress) => {
      setProgress(_progress);
    });

    return await freshManager.write();
  }


  const startEncode = async () => {
    if (carrierManager === undefined) {
      return;
    }

    msg("Encoding items...");
    setProgressVisible(true);

    try {
      const blob = await runEncodeAndWrite();
      onWriteSuccess(blob);
      setProgressVisible(false);
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        return;
      }
      onEncodeError(error);
    }
  }


  const startPreview = async () => {
    if ((carrierManager === undefined) || (originalFile === null)) {
      return;
    }

    msg("Preparing preview...");
    setProgressVisible(true);

    try {
      const blob = await runEncodeAndWrite();
      const beforeUrl = URL.createObjectURL(originalFile);
      const afterUrl = URL.createObjectURL(blob);
      setDiffPreview({ beforeUrl, afterUrl, blob });
      msg("Preview ready.");
      setProgressVisible(false);
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        return;
      }
      toast.error("Couldn't generate the preview (" + error + ").", { toastId: 'preview-error' });
      msg("Preview failed.");
      setProgressVisible(false);
    }
  }


  const handleSaveFromPreview = () => {
    if (!diffPreview) return;
    onWriteSuccess(diffPreview.blob);
    closeDiffPreview();
  }


  const isCarrier = () => {
    return ((carrierManager !== undefined) && (carrierManager.isFileRead()));
  }


  const canExport = () => {
    return (isCarrier() && (storUsedCap < storTotalCap));
  }


  const handleExport = () => {
    if (!canExport()) {
      return;
    }

    startEncode();
  }


  const getStorSizeLabel = () => {
    if (storTotalCap === 0) {
      return "";
    }
    return UiUtils.formatFileSize(storUsedCap) + " / " + UiUtils.formatFileSize(storTotalCap);
  }

  const getStorWarning = () => {
    if (storTotalCap === 0) {
      return "";
    }
    if (storUsedCap >= storTotalCap) {
      return "Not enough space.";
    }
    if (storRateCap > 67) {
      return "Strong visual alteration.";
    }
    if (storRateCap > 33) {
      return "Visual alteration.";
    }
    return "";
  }

  const getStorWarningLevel = () => {
    if (storUsedCap >= storTotalCap) {
      return "danger";
    }
    if (storRateCap > 33) {
      return "warning";
    }
    return "";
  }


  return (
    <div className="App">
      <div className="bg-pattern" aria-hidden="true" />
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar
        closeOnClick
        pauseOnHover
        draggable={false}
        newestOnTop
      />
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1 className="app-title">Kyowa</h1>
            <p className="app-tagline">Hide files inside an image.</p>
          </div>
          <ThemeSwitcher />
        </header>

        <div className="workflow">
          <section className="step">
            <div className="step-marker">
              <span className="step-index">1</span>
              <span className="step-thread" />
            </div>
            <div className="step-content">
              <h2 className="step-title">Image</h2>
              <ImagePanel callback={cbImageInputChanged} />
            </div>
          </section>

          <section className="step">
            <div className="step-marker">
              <span className="step-index">2</span>
              <span className="step-thread" />
            </div>
            <div className="step-content">
              <h2 className="step-title">Passphrase</h2>
              <PassPanel callback={cbPassMasterChanged} initialCredentials={credentials} />
            </div>
          </section>

          <section className="step">
            <div className="step-marker">
              <span className="step-index">3</span>
              <span className="step-thread" />
            </div>
            <div className="step-content">
              <h2 className="step-title">Hidden files</h2>

              <div className="status-bar">
                <span className="status-text">{status}</span>
                <ProgressBar value={progress} showValue={false} style={{ visibility: (progressVisible ? 'visible' : 'hidden') }}></ProgressBar>
              </div>

              <EditableList listUpdate={cbListUpdate} list={listItems} onTryDecodeItem={tryDecodeItem} />

              {(storTotalCap > 0) && (
                <div className="capacity">
                  <div className="capacity-row">
                    <span className="capacity-label">Storage</span>
                    <span className="capacity-value">
                      {getStorSizeLabel()} <span className="capacity-percent">({Math.round(storRateCap)}%)</span>
                    </span>
                  </div>

                  <div
                    className="capacity-gauge"
                    role="img"
                    aria-label={`Storage used: ${Math.round(storRateCap)} percent. ${getStorWarning() || 'Safe zone.'}`}
                  >
                    <div className="capacity-gauge-track">
                      <div className="capacity-gauge-zone capacity-gauge-zone--warning" />
                      <div className="capacity-gauge-zone capacity-gauge-zone--danger" />
                      <div className="capacity-gauge-fill" style={{ width: `${Math.min(storRateCap, 100)}%` }} />
                    </div>
                    <div className="capacity-gauge-scale">
                      <span className="capacity-gauge-scale-start">0%</span>
                      <span className="capacity-gauge-scale-mark" style={{ left: '33%' }}>33%</span>
                      <span className="capacity-gauge-scale-mark" style={{ left: '67%' }}>67%</span>
                      <span className="capacity-gauge-scale-end">100%</span>
                    </div>
                  </div>

                  {getStorWarning() && (
                    <p className={`capacity-warning capacity-warning--${getStorWarningLevel()}`}>
                      {getStorWarning()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="actions">
          <button className="btn-secondary" onClick={startPreview} disabled={!canExport()}>
            Compare before / after
          </button>
          <button className="btn-primary" onClick={handleExport} disabled={!canExport()}>
            {progressVisible && <i className="pi pi-spin pi-cog" style={{ marginRight: '0.5rem' }}></i>}
            Save image
          </button>
        </div>
      </div>

      {diffPreview && (
        <DiffPreviewModal
          beforeUrl={diffPreview.beforeUrl}
          afterUrl={diffPreview.afterUrl}
          onClose={closeDiffPreview}
          onSave={handleSaveFromPreview}
        />
      )}
    </div>
  );
}

export default App;