import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';

export const useSignUpMutation = () => {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: async (signUpData) => {
            // 백엔드의 회원가입 엔드포인트 호출
            const response = await apiClient.post('/users/signup', signUpData);
            return response.data;
        },
        onSuccess: () => {
            alert('회원가입이 완료되었습니다! 로그인 후 이용해주세요.');
            navigate('/login'); // 가입 성공 시 로그인 페이지로 이동
        },
        onError: (error) => {
            // 백엔드 Custom Exception(BusinessException)의 에러 메시지 활용
            console.error('회원가입 실패:', error);
        }
    });
};