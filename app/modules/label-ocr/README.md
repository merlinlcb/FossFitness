# label-ocr

Reads nutrition labels on the phone with [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
through [Tesseract4Android](https://github.com/adaptech-cz/Tesseract4Android) 4.9.0 (Apache-2.0,
bundles Tesseract 5.5.1 and Leptonica 1.85.0). Nothing is sent anywhere.

JS: `requireNativeModule('LabelOcr').recognize(uri)` returns the recognised text.

## Model

`android/src/main/assets/tessdata/eng.traineddata` is the English "fast" LSTM model from
[tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (Apache-2.0):

    https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata
    sha256 7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2
