class UiUtils {

    public static formatFileSize(size) {
        if (size < 1024) {
            return `${size}\xA0bytes`;
        } else if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(2)}\xA0kB`;
        } else {
            return `${(size / (1024 * 1024)).toFixed(2)}\xA0MB`;
        }
    }

}

export default UiUtils;