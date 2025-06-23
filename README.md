얼굴 인식 앱
이 프로젝트는 React Native 기반의 실시간 얼굴 인식 애플리케이션입니다. 기기 카메라를 사용하여 얼굴을 감지하고, 감지된 얼굴을 등록 및 인식할 수 있습니다. **FaceNet 모델 (facenet.tflite)**을 사용하여 얼굴 임베딩을 추출하고, 저장된 얼굴과 코사인 유사도로 비교합니다.

주요 기능
실시간 얼굴 감지: react-native-vision-camera-face-detector를 활용하여 효율적인 얼굴 감지를 수행합니다.
FaceNet 임베딩 추출: react-native-fast-tflite를 사용하여 고차원 얼굴 임베딩을 추출합니다.
얼굴 등록 및 인식: 새로운 얼굴을 추가하고 이전에 등록된 얼굴을 식별하는 핵심 기능입니다.
얼굴 이미지 자르기 및 크기 조정: react-native-photo-manipulator를 사용하여 얼굴 이미지 전처리를 수행합니다.
로컬 데이터 저장: AsyncStorage를 통해 얼굴 데이터를 저장하고 로드합니다.
얼굴 이미지 전처리 및 임베딩 추출 과정
정확한 얼굴 인식을 위해 감지된 얼굴은 임베딩 추출 전에 일련의 전처리 단계를 거칩니다.

1. 얼굴 영역 자르기 및 크기 조정
얼굴이 감지되면, 감지된 얼굴의 바운딩 박스를 기준으로 이미지를 자릅니다. 잘라낸 이미지는 FaceNet 모델이 요구하는 입력 크기(160x160 픽셀)로 크기가 조정됩니다. 이 과정은 PhotoManipulator.crop을 사용하여 처리됩니다.

JavaScript
```
const cropRegion = {
  x: Math.floor(bounds.x),
  y: Math.floor(bounds.y),
  width: Math.ceil(bounds.width),
  height: Math.ceil(bounds.height),
}
const targetSize = { width: INPUT_SIZE, height: INPUT_SIZE }
const filePath = path.startsWith('file://') ? path : 'file://' + path

// 자르기 및 크기 조정
const croppedPath = await PhotoManipulator.crop(filePath, cropRegion, targetSize)
2. 잘라낸 이미지를 Base64 또는 바이너리로 읽기
잘라낸 이미지 파일은 Base64 문자열로 읽어옵니다. react-native-file-access의 FileSystem.readFile이 이 단계에 사용됩니다.
```
JavaScript
```
const base64Data = await FileSystem.readFile(croppedPath, 'base64')
3. 이미지 데이터 변환 (정규화 등)
Base64 데이터는 바이너리로 변환된 후, JPEG 디코더(jpeg-js 등)를 사용하여 픽셀 데이터를 추출합니다. RGB 채널만 추출되며, 픽셀 값은 -1에서 1 범위로 정규화됩니다.

JavaScript

import jpeg from 'jpeg-js'

const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
const decoded = jpeg.decode(binaryData, { useTArray: true })

const float32Data = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3)
for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 3) {
  float32Data[j] = decoded.data[i] / 127.5 - 1       // R
  float32Data[j+1] = decoded.data[i+1] / 127.5 - 1   // G
  float32Data[j+2] = decoded.data[i+2] / 127.5 - 1   // B
}
4. 변환된 데이터를 Float32Array로 반환
최종적으로 width, height, 픽셀 데이터의 Float32Array, 그리고 잘라낸 이미지의 path를 포함하는 객체가 반환됩니다.
```
JavaScript
```
return {
  width: INPUT_SIZE,
  height: INPUT_SIZE,
  data: float32Data,
  path: croppedPath,
}
```
전체 전처리 함수 예시
완전한 prepareCapturedFace 함수의 예시는 다음과 같습니다.

JavaScript
```
const prepareCapturedFace = async (capturedFaceData) => {
  if (!capturedFaceData || !capturedFaceData.path || !capturedFaceData.bounds) {
    throw new Error('캡처된 얼굴 데이터가 유효하지 않습니다.')
  }
  const { path, bounds } = capturedFaceData
  const cropRegion = {
    x: Math.floor(bounds.x),
    y: Math.floor(bounds.y),
    width: Math.ceil(bounds.width),
    height: Math.ceil(bounds.height),
  }
  const targetSize = { width: INPUT_SIZE, height: INPUT_SIZE }
  const filePath = path.startsWith('file://') ? path : 'file://' + path

  // 1. 자르기 및 크기 조정
  const croppedPath = await PhotoManipulator.crop(filePath, cropRegion, targetSize)

  // 2. Base64로 읽기
  const base64Data = await FileSystem.readFile(croppedPath, 'base64')

  // 3. JPEG 디코딩 및 정규화 (jpeg-js 필요)
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
  const decoded = jpeg.decode(binaryData, { useTArray: true })

  const float32Data = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3)
  for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 3) {
    float32Data[j] = decoded.data[i] / 127.5 - 1
    float32Data[j+1] = decoded.data[i+1] / 127.5 - 1
    float32Data[j+2] = decoded.data[i+2] / 127.5 - 1
  }

  return {
    width: INPUT_SIZE,
    height: INPUT_SIZE,
    data: float32Data,
    path: croppedPath,
  }
}
```
