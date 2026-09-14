import React, { useState } from 'react';

import 'primeicons/primeicons.css';
import { ProgressBar } from 'primereact/progressbar';

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
import { TaskCancelledError } from './util/Task.ts';

import UiUtils from './util/UiUtils.ts';



let carrierManager: CarrierManagerBase | undefined;

function App() {

  const [fileName, setFileName] = useState<string>("");
  const [credentials, setCredentials] = useState(new Credentials());
  const [status, setStatus] = useState("Open an image file");
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const [listItems, setListItems] = useState<ItemData[]>([]);
  const [storRateCap, setStorRateCap] = useState<number>(0.5);
  const [storTotalCap, setStorTotalCap] = useState<number>(0);
  const [storUsedCap, setStorUsedCap] = useState<number>(0);


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
    console.log("onDecodeError : " + err);
  }

  const onAfterDecode = () => {
    setProgressVisible(false);
  }


  /**
   * Relance un décodage sur l'image courante. Chaque appel arrête et
   * remplace toute tentative de décodage en cours (via carrierManager.stop()
   * dans Task.run()) : si une Promise précédente était en attente, elle est
   * rejetée avec une TaskCancelledError qu'on ignore silencieusement ici,
   * pour laisser la place au décodage le plus récent.
   */
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
    updateImageStorageCapacities();
    tryDecode();
  }

  const onReadError = (err) => {
    msg("Image could not be read : " + err);
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


  const cbImageInputChanged = (file: File) => {
    setFileName(file.name);
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
    msg("Image write success.");

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  const onWriteError = (err) => {
    msg("Image write error (" + err + ").");
  }

  const onAfterWrite = () => {
    setProgressVisible(false);
  }


  const startWrite = async () => {
    if (carrierManager === undefined) {
      return;
    }

    setProgressVisible(true);

    carrierManager.stop();
    carrierManager = carrierManager.newInstance();

    try {
      const blob = await carrierManager.write();
      onWriteSuccess(blob);
      onAfterWrite();
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        return;
      }
      onWriteError(error);
      onAfterWrite();
    }
  }


  const onEncodeSuccess = () => {
    msg("Items encoded.");
    startWrite();
  }

  const onEncodeError = (err) => {
    msg("Encoding error (" + err + ").");
    setProgressVisible(false);
  }


  const startEncode = async () => {

    if (carrierManager === undefined) {
      return;
    }

    msg("Encoding items...");
    setProgressVisible(true);

    let dc = new DataContainer();

    if (listItems !== undefined) {
      // Convert back ItemData to BlockData and encode
      for (const item of listItems) {
        if (!item.flagDelete) {
          let newBlk = DataConv.toBlockData(item);
          await newBlk.encode(item.pass);
          dc.addDataBlock(newBlk);
        }
      }
    }

    carrierManager.stop();
    carrierManager = carrierManager.newInstance();

    try {
      await carrierManager.encode(credentials, dc, (_progress) => {
        setProgress(_progress);
      });
      onEncodeSuccess();
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        return;
      }
      onEncodeError(error);
    }
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


  const getStorLabel = () => {
    let rate = "";
    if (storTotalCap > 0) {
      rate = UiUtils.formatFileSize(storUsedCap) + " / " + UiUtils.formatFileSize(storTotalCap);
      if (storUsedCap >= storTotalCap) {
        rate += " ⚠️⚠️⚠️ Not enough space !";
      } else
        if (storRateCap > 67) {
          rate += " ⚠️⚠️ Strong visual alteration"
        } else
          if (storRateCap > 33) {
            rate += " ⚠️ Visual alteration"
          }
    }
    return rate;
  }

  const getStorColor = () => {
    let storCol = "#3B82F6"; // Default blue color
    if (storTotalCap > 0) {
      storCol = "#2AD02A"; // Green
      if (storRateCap > 33) {
        storCol = "#FFC02A"; // Orange
      }
      if (storRateCap > 67) {
        storCol = "#D08080"; // Red
      }
    }
    return storCol;
  }


  return (
    <div className="App">
      <header className="App-header">
        <div className='container'>
          <div className='mainAppItem'>
            <ImagePanel callback={cbImageInputChanged} />
          </div>
          <div className='mainAppItem'>
            <PassPanel callback={cbPassMasterChanged} initialCredentials={credentials} />
          </div>
          <div className='card'>
            <span>{status}</span>
            <ProgressBar value={progress} showValue={false} style={{ visibility: (progressVisible ? 'visible' : 'hidden') }}></ProgressBar>
          </div>
          <div className='card mainAppItem'>
            <EditableList listUpdate={cbListUpdate} list={listItems} onTryDecodeItem={tryDecodeItem} />
          </div>
          <div>
            {(storTotalCap > 0) && (
              <div style={{ marginBottom: "10px" }}>
                <span>{getStorLabel()}</span>
                <ProgressBar value={storRateCap} showValue={false} color={getStorColor()}></ProgressBar>
              </div>
            )}
          </div>
          <div className='card linePanel'>
            <table align='center'>
              <tbody>
                <tr>
                  <td>
                    <button onClick={handleExport} disabled={!canExport()}>
                      <i className={canExport() ? "pi pi-spin pi-cog" : "pi pi-cog"} style={{ fontSize: '2rem' }}></i>
                    </button>
                  </td>
                  <td>
                    <button onClick={handleExport} disabled={!canExport()}>
                      Process & Download
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;