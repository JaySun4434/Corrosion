/* Optional authorized source table values. Empty in the publicly distributable starter build.
 * Use: python build_authorized_data.py YOUR_LICENSED_ANNEX_A.csv --rights-confirmed
 * Only after the copyright owner grants suitable republication rights.
 */
(function(root){
  'use strict';
  if(root.CORR_DATA && root.CORR_DATA.annexA){
    Object.assign(root.CORR_DATA.annexA.licensedEntries, {});
  }
})(typeof window!=='undefined'?window:globalThis);
