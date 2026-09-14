

let globalUid: number = 0;

class ItemData {
  public uid: number;
  public name: string;
  public flagNameEdited: boolean;
  public flagDelete: boolean;
  public flagNew: boolean;
  public flagDecoded: boolean;
  public encodedData: Uint8Array | null;
  public decodedData: Uint8Array | null;
  public contentType: string;
  public pass: string;

  public constructor() {
    this.uid = globalUid++;
    this.name = "New element";
    this.flagNameEdited = false;
    this.flagDelete = false;
    this.flagNew = true;
    this.flagDecoded = true;
    this.encodedData = null;
    this.decodedData = new Uint8Array(0);
    this.contentType = "text/plain";
    this.pass = "";
  }


  public hasDecodedData(): boolean {
    return ((this.decodedData !== null) && (this.decodedData.length > 0));
  }

  public hasEncodedData(): boolean {
    return (this.encodedData !== null);
  }

  public isDecoded(): boolean {
    return this.flagDecoded;
  }

  public isText(): boolean {
    return (this.contentType === 'text/plain') && (this.decodedData !== null);
  }

  public isContentEditable(): boolean {

    if (this.isDecoded() && !this.isText()) {
      return false;
    }

    if (!this.isDecoded()) {
      return false;
    }

    return true;
  }

  public isPreviewable(): boolean {
    return (this.hasDecodedData());
  }

  
}

export default ItemData;