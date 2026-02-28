import httpStatus from "http-status";
import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { authServices } from "./auth.service";
import config from "../../../config";
import { sendResponse } from "../../../shared/sendResponse";
import { AppError } from "../../../utils/app_error";
const register = catchAsync(async (req, res) => {
    try {
        const payload = req.body;
        const result = await authServices.register(payload);
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            ...result,
        });
    } catch (err: any) {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({
                success: false,
                message: err.message,
            });
        } else {
            console.error("Register Error:", err);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

});
const login = catchAsync(async (req, res) => {
    try {
        const payload = req.body;
        const result = await authServices.login(payload);
        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            ...result,
        });
    } catch (err: any) {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({
                success: false,
                message: err.message,
            });
        } else {
            console.error("Login Error:", err);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

});



export const authControllers = {
    register,
    login
};