import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, Button, View, useWindowDimensions } from 'react-native'
import {
  CameraPosition,
  DrawableFrame,
  Frame,
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useTensorflowModel,
} from 'react-native-vision-camera'
import { useIsFocused } from '@react-navigation/core'
// import { useAppState } from '@react-native-community/hooks';
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { Camera, Face, FaceDetectionOptions, Contours, Landmarks } from 'react-native-vision-camera-face-detector'
import { ClipOp, Skia, TileMode } from '@shopify/react-native-skia'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

/**
 * Face detection component
 *
 * @return {JSX.Element} Component
 */
const FaceDetection = (): JSX.Element => {
  const { width, height } = useWindowDimensions()
  //useTensorflowModel example
  const { loadModel, unloadModel } = useTensorflowModel({
    model: 'face_landmark.tflite',
    type: 'tensorflowLite',
  })
  const { hasPermission, requestPermission } = useCameraPermission()
  const [cameraMounted, setCameraMounted] = useState<boolean>(false)
  const [cameraPaused, setCameraPaused] = useState<boolean>(false)
  const [autoMode, setAutoMode] = useState<boolean>(true)
  const [cameraFacing, setCameraFacing] = useState<CameraPosition>('front')
  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    classificationMode: 'all',
    contourMode: 'all',
    landmarkMode: 'all',
    windowWidth: width,
    windowHeight: height,
  }).current
  const isFocused = useIsFocused()
  // const appState = useAppState();
  const isCameraActive = !cameraPaused && isFocused
  // appState === 'active'
  const cameraDevice = useCameraDevice(cameraFacing)
  //
  // vision camera ref
  //
  const camera = useRef<VisionCamera>(null)
  //
  // face rectangle position
  //
  const aFaceW = useSharedValue(0)
  const aFaceH = useSharedValue(0)
  const aFaceX = useSharedValue(0)
  const aFaceY = useSharedValue(0)
  const aRot = useSharedValue(0)

  // 각 포인트의 위치를 저장할 16개의 SharedValue 배열 생성
  const eyePointsX = Array(16)
    .fill(0)
    .map(() => useSharedValue(0))
  const eyePointsY = Array(16)
    .fill(0)
    .map(() => useSharedValue(0))
  const eyePointsX2 = Array(16)
    .fill(0)
    .map(() => useSharedValue(0))
  const eyePointsY2 = Array(16)
    .fill(0)
    .map(() => useSharedValue(0))

  const boundingBoxStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    borderWidth: 4,
    borderLeftColor: 'rgb(0,255,0)',
    borderRightColor: 'rgb(0,255,0)',
    borderBottomColor: 'rgb(0,255,0)',
    borderTopColor: 'rgb(255,0,0)',
    width: withTiming(aFaceW.value, {
      duration: 100,
    }),
    height: withTiming(aFaceH.value, {
      duration: 100,
    }),
    left: withTiming(aFaceX.value, {
      duration: 100,
    }),
    top: withTiming(aFaceY.value, {
      duration: 100,
    }),
    transform: [
      {
        rotate: `${aRot.value}deg`,
      },
    ],
  }))

  useEffect(() => {
    if (hasPermission) return
    requestPermission()
  }, [hasPermission, requestPermission])

  // 각 포인트에 대한 애니메이션 스타일을 생성하는 함수

  const createEyePointStyle = (index) => {
    return useAnimatedStyle(() => {
      return {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: index === 0 ? 'red' : index === 4 ? 'yellow' : 'cyan',
        left: withTiming(eyePointsX[index].value - 4, { duration: 100 }),
        top: withTiming(eyePointsY[index].value - 4, { duration: 100 }),
        transform: [{ rotate: `${aRot.value}deg` }],
      }
    })
  }

  const createEyePointStyle2 = (index) => {
    return useAnimatedStyle(() => {
      return {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: index === 0 ? 'red' : index === 4 ? 'yellow' : 'cyan',
        left: withTiming(eyePointsX2[index].value - 4, { duration: 100 }),
        top: withTiming(eyePointsY2[index].value - 4, { duration: 100 }),
        transform: [{ rotate: `${aRot.value}deg` }],
      }
    })
  }

  // 각 포인트에 대한 스타일 배열 생성
  const eyePointStyles = Array(16)
    .fill(0)
    .map((_, index) => createEyePointStyle(index))

  const eyePointStyles2 = Array(16)
    .fill(0)
    .map((_, index) => createEyePointStyle2(index))
  // 렌더링 부분에 포인트 요소들 추가

  /**
   * Handle camera UI rotation
   *
   * @param {number} rotation Camera rotation
   */
  const handleUiRotation = (rotation: number) => {
    aRot.value = rotation
  }

  /**
   * Hanldes camera mount error event
   *
   * @param {any} error Error event
   */
  const handleCameraMountError = (error: any) => {
    console.error('camera mount error', error)
  }

  // handleFacesDetected 함수 수정
  const handleFacesDetected = (faces: Face[], frame: Frame): void => {
    // 얼굴이 감지되지 않은 경우
    if (Object.keys(faces).length <= 0) {
      aFaceW.value = 0
      aFaceH.value = 0
      aFaceX.value = 0
      aFaceY.value = 0
      return
    }

    console.log('faces', faces.length, 'frame', frame.toString())

    const { bounds, contours } = faces[0]
    console.log('bounds', bounds)

    // 기존 얼굴 경계 업데이트
    const { width, height, x, y } = bounds
    aFaceW.value = width + 70
    aFaceH.value = height + 50
    aFaceX.value = x - 50
    aFaceY.value = y - 25

    // LEFT_EYE 각 포인트 위치 업데이트
    if (contours?.LEFT_EYE) {
      for (let i = 0; i < 16; i++) {
        if (contours.LEFT_EYE[i]) {
          eyePointsX[i].value = contours.LEFT_EYE[i].x
          eyePointsY[i].value = contours.LEFT_EYE[i].y
        }
      }
    }
    // RIGHT_EYE 각 포인트 위치 업데이트
    if (contours?.RIGHT_EYE) {
      for (let i = 0; i < 16; i++) {
        if (contours.RIGHT_EYE[i]) {
          eyePointsX2[i].value = contours.RIGHT_EYE[i].x
          eyePointsY2[i].value = contours.RIGHT_EYE[i].y
        }
      }
    }

    // only call camera methods if ref is defined
    if (camera.current) {
      // take photo, capture video, etc...
    }
  }

  // 렌더링 부분에 포인트 요소들 추가
  const renderEyePoints = () => {
    return eyePointStyles.map((style, index) => <Animated.View key={`eye-point-${index}`} style={style} />)
  }

  const renderEyePoints2 = () => {
    return eyePointStyles2.map((style, index) => <Animated.View key={`eye-point2-${index}`} style={style} />)
  }

  /**
   * Handle skia frame actions
   *
   * @param {Face[]} faces Detection result
   * @param {DrawableFrame} frame Current frame
   * @returns {void}
   */
  const handleSkiaActions = (faces: Face[], frame: DrawableFrame): void => {
    'worklet'
    // if no faces are detected we do nothing
    if (Object.keys(faces).length <= 0) return

    console.log('SKIA - faces', faces.length, 'frame', frame.toString())

    const { bounds, contours, landmarks } = faces[0]

    // draw a blur shape around the face points
    const blurRadius = 25
    const blurFilter = Skia.ImageFilter.MakeBlur(blurRadius, blurRadius, TileMode.Repeat, null)
    const blurPaint = Skia.Paint()
    blurPaint.setImageFilter(blurFilter)
    const contourPath = Skia.Path.Make()
    const necessaryContours: (keyof Contours)[] = ['FACE', 'LEFT_CHEEK', 'RIGHT_CHEEK']

    necessaryContours.forEach((key) => {
      contours?.[key]?.forEach((point, index) => {
        if (index === 0) {
          // it's a starting point
          contourPath.moveTo(point.x, point.y)
        } else {
          // it's a continuation
          contourPath.lineTo(point.x, point.y)
        }
      })
      contourPath.close()
    })

    frame.save()
    frame.clipPath(contourPath, ClipOp.Intersect, true)
    frame.render(blurPaint)
    frame.restore()

    // draw mouth shape
    const mouthPath = Skia.Path.Make()
    const mouthPaint = Skia.Paint()
    mouthPaint.setColor(Skia.Color('red'))
    const necessaryLandmarks: (keyof Landmarks)[] = ['MOUTH_BOTTOM', 'MOUTH_LEFT', 'MOUTH_RIGHT']

    necessaryLandmarks.forEach((key, index) => {
      const point = landmarks?.[key]
      if (!point) return

      if (index === 0) {
        // it's a starting point
        mouthPath.moveTo(point.x, point.y)
      } else {
        // it's a continuation
        mouthPath.lineTo(point.x, point.y)
      }
    })
    mouthPath.close()
    frame.drawPath(mouthPath, mouthPaint)

    // draw a rectangle around the face
    const rectPaint = Skia.Paint()
    rectPaint.setColor(Skia.Color('blue'))
    rectPaint.setStyle(1)
    rectPaint.setStrokeWidth(5)
    frame.drawRect(bounds, rectPaint)
  }

  return (
    <>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}>
        {hasPermission && cameraDevice ? (
          <>
            {cameraMounted && (
              <>
                <Camera
                  ref={camera as React.RefObject<any>}
                  style={StyleSheet.absoluteFill}
                  isActive={isCameraActive}
                  device={cameraDevice}
                  onError={handleCameraMountError}
                  faceDetectionCallback={handleFacesDetected}
                  onUIRotationChanged={handleUiRotation}
                  skiaActions={handleSkiaActions}
                  faceDetectionOptions={{
                    ...faceDetectionOptions,
                    autoMode,
                    cameraFacing,
                  }}
                />

                <Animated.View style={boundingBoxStyle} />

                {/* {LeftEye} */}
                {renderEyePoints()}

                {/* 포인트를 연결하는 선 (옵션) */}
                {false && (
                  <Svg style={StyleSheet.absoluteFill}>
                    <AnimatedPath
                      animatedProps={useAnimatedProps(() => {
                        let d = ''
                        for (let i = 0; i < 16; i++) {
                          if (i === 0) {
                            d += `M ${eyePointsX[i].value} ${eyePointsY[i].value}`
                          } else {
                            d += ` L ${eyePointsX[i].value} ${eyePointsY[i].value}`
                          }
                        }
                        d += ' Z' // 경로 닫기
                        return { d }
                      })}
                      stroke="rgba(0, 255, 255, 0.5)"
                      strokeWidth="1"
                      fill="transparent"
                    />
                  </Svg>
                )}

                {/* {RightEye} */}
                {renderEyePoints2()}

                {/* 포인트를 연결하는 선 (옵션) */}
                {false && (
                  <Svg style={StyleSheet.absoluteFill}>
                    <AnimatedPath
                      animatedProps={useAnimatedProps(() => {
                        let d = ''
                        for (let i = 0; i < 16; i++) {
                          if (i === 0) {
                            d += `M ${eyePointsX2[i].value} ${eyePointsY2[i].value}`
                          } else {
                            d += ` L ${eyePointsX2[i].value} ${eyePointsY2[i].value}`
                          }
                        }
                        d += ' Z' // 경로 닫기
                        return { d }
                      })}
                      stroke="rgba(0, 255, 255, 0.5)"
                      strokeWidth="1"
                      fill="transparent"
                    />
                  </Svg>
                )}

                {/* Camera status */}

                {cameraPaused && (
                  <Text
                    style={{
                      width: '100%',
                      backgroundColor: 'rgb(0,0,255)',
                      textAlign: 'center',
                      color: 'white',
                    }}>
                    Camera is PAUSED
                  </Text>
                )}
              </>
            )}

            {!cameraMounted && (
              <Text
                style={{
                  width: '100%',
                  backgroundColor: 'rgb(255,255,0)',
                  textAlign: 'center',
                }}>
                Camera is NOT mounted
              </Text>
            )}
          </>
        ) : (
          <Text
            style={{
              width: '100%',
              backgroundColor: 'rgb(255,0,0)',
              textAlign: 'center',
              color: 'white',
            }}>
            No camera device or permission
          </Text>
        )}
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
        <View
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-around',
          }}>
          <Button onPress={() => setCameraFacing((current) => (current === 'front' ? 'back' : 'front'))} title={'Toggle Cam'} />

          <Button onPress={() => setAutoMode((current) => !current)} title={`${autoMode ? 'Disable' : 'Enable'} AutoMode`} />
        </View>
        <View
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-around',
          }}>
          <Button onPress={() => setCameraPaused((current) => !current)} title={`${cameraPaused ? 'Resume' : 'Pause'} Cam`} />

          <Button onPress={() => setCameraMounted((current) => !current)} title={`${cameraMounted ? 'Unmount' : 'Mount'} Cam`} />
        </View>
      </View>
    </>
  )
}

/**
 * App component
 *
 * @return {JSX.Element} Component
 */
export function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <FaceDetection />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
