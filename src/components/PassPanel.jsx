import React, { useState, useEffect, useRef } from 'react';
import { FaKey } from 'react-icons/fa';
import Credentials from '../model/Credentials.ts';
import { Password } from 'primereact/password';

const PASS_DEBOUNCE_MS = 450;

const PassPanel = ({ callback, initialCredentials }) => {
  const [selectedAlgo, setSelectedAlgo] = useState(initialCredentials.hashAlgo || 'Argon2id');
  const [passMaster, setPassMaster] = useState(initialCredentials.passMaster || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const doSubmit = (algo, pass) => {
    callback(new Credentials(algo, pass));
  }

  const handleSelectChange = (event) => {
    const newAlgo = event.target.value;
    setSelectedAlgo(newAlgo);
    // Changement explicite de méthode : pas de délai.
    doSubmit(newAlgo, passMaster);
  };

  const handlePassMasterChange = (event) => {
    const newPass = event.target.value;
    setPassMaster(newPass);

    // Débounce : Argon2id est volontairement coûteux (résistance au
    // brute-force), on évite donc de relancer un calcul à chaque frappe.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      doSubmit(selectedAlgo, newPass);
    }, PASS_DEBOUNCE_MS);
  };

  return (
    <div className='card linePanel flexv' style={{ alignItems: 'flex-start' }}>
      <div className='flex' style={{ flexWrap: 'wrap' }}>
        <div className='flex'>
          <FaKey />
        </div>
        <div className='flex'>
          <select id="hashAlgo" value={selectedAlgo} onChange={handleSelectChange}>
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-512">SHA-512</option>
            <option value="Argon2id">Argon2id</option>
          </select>
        </div>
        <div className='flex'>
          <Password inputId="passMaster" value={passMaster} onChange={handlePassMasterChange}
            toggleMask feedback={false} />
        </div>
      </div>
      {selectedAlgo === 'Argon2id' && (
        <p className="hash-algo-hint">
          Slower on purpose (memory-hard, resists brute-force). This only strengthens the
          hiding pattern's seed — hidden files are still encrypted with AES via PBKDF2,
          independently of this setting.
        </p>
      )}
    </div>
  );
};

export default PassPanel;